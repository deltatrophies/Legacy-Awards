import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { env, razorpayEnabled } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { razorpay } from "../../config/razorpay.js";
import { AppError } from "../../common/errors/AppError.js";
import { createReference } from "../../common/utils/identifiers.js";
import { Order } from "../orders/order.model.js";
import { getPublicQuote } from "../quotes/quote.service.js";
import { Quote } from "../quotes/quote.model.js";
import { Payment } from "./payment.model.js";

const INITIALIZATION_TIMEOUT_MS = 2 * 60 * 1000;
const SUPPORTED_WEBHOOKS = new Map([
  ["payment.authorized", "authorized"],
  ["payment.captured", "captured"],
  ["payment.failed", "failed"],
  ["payment.refunded", "refunded"],
]);

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
};

const gatewayErrorDetails = (error) => ({
  code: error?.error?.code || error?.code || "RAZORPAY_ERROR",
  description: error?.error?.description || error?.message || "Razorpay request failed",
});

function toAmountMinor(amount) {
  const value = Number(amount);
  const minor = Math.round(value * 100);
  if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(minor)) {
    throw new AppError(422, "INVALID_PAYMENT_AMOUNT", "The quoted amount is not valid for online payment");
  }
  return minor;
}

function buildOrderSnapshot(quote) {
  return {
    user: quote.user,
    customer: quote.customer.toObject?.() || quote.customer,
    items: quote.items.map((item) => item.toObject?.() || item),
    subtotal: quote.subtotal,
    discount: quote.discount,
    total: quote.total,
    currency: String(quote.currency || "INR").toUpperCase(),
  };
}

function storedGatewayOrderIds(payment) {
  return new Set([payment.razorpayOrderId, ...(payment.razorpayOrderIds || [])].filter(Boolean));
}

export function verifyCheckoutSignature(orderId, paymentId, signature, secret = env.RAZORPAY_KEY_SECRET) {
  const expected = createHmac("sha256", secret || "")
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqual(expected, signature);
}

export function validateGatewayPayment(entity, payment, gatewayOrderId) {
  const amountMinor = payment.amountMinor || toAmountMinor(payment.amount);
  if (entity?.order_id !== gatewayOrderId) {
    throw new AppError(400, "PAYMENT_ORDER_MISMATCH", "Payment does not belong to this order");
  }
  if (Number(entity.amount) !== amountMinor) {
    throw new AppError(400, "PAYMENT_AMOUNT_MISMATCH", "Paid amount does not match the quoted amount");
  }
  if (String(entity.currency || "").toUpperCase() !== String(payment.currency || "INR").toUpperCase()) {
    throw new AppError(400, "PAYMENT_CURRENCY_MISMATCH", "Payment currency does not match the quote");
  }
  return true;
}

export function nextPaymentStatus(current, incoming) {
  if (current === "refunded") return "refunded";
  if (incoming === "refunded") return "refunded";
  if (current === "captured" && incoming !== "refunded") return "captured";
  // A failed payment is only one attempt on a reusable Razorpay Order. Keep the
  // order open so retries cannot create a second payable gateway order.
  if (incoming === "failed" && ["created", "authorized"].includes(current)) return current;
  return incoming;
}

async function ensureOrder(payment) {
  if (payment.status !== "captured") {
    throw new AppError(409, "PAYMENT_NOT_CAPTURED", "The payment must be captured before creating an order");
  }
  const fullPayment = await Payment.findById(payment._id).select("+orderSnapshot").populate("quote");
  if (!fullPayment?.quote) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found for this payment");
  const snapshot = fullPayment.orderSnapshot || buildOrderSnapshot(fullPayment.quote);
  const paidAt = fullPayment.capturedAt || fullPayment.verifiedAt || new Date();
  const order = await Order.findOneAndUpdate(
    { quote: fullPayment.quote._id },
    {
      $setOnInsert: {
        reference: createReference("LAO"),
        quote: fullPayment.quote._id,
        user: snapshot.user,
        customer: snapshot.customer,
        items: snapshot.items,
        subtotal: snapshot.subtotal,
        discount: snapshot.discount,
        total: snapshot.total,
        currency: snapshot.currency,
        fulfillmentStatus: "pending",
      },
      $set: {
        paymentStatus: "paid",
        paymentProvider: "razorpay",
        gatewayPaymentId: fullPayment.razorpayPaymentId,
        paidAt,
        payment: fullPayment._id,
      },
    },
    { new: true, upsert: true, runValidators: true },
  );
  await Quote.updateOne(
    { _id: fullPayment.quote._id, paymentStatus: { $ne: "refunded" } },
    { $set: { paymentStatus: "paid", paidAt } },
  );
  return order;
}

async function getPayableQuote(reference, quoteToken, userId) {
  if (quoteToken) return getPublicQuote(reference, quoteToken);
  if (!userId) throw new AppError(401, "QUOTE_TOKEN_REQUIRED", "A quote access token or signed-in account is required");
  const quote = await Quote.findOne({ reference, user: userId });
  if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  return quote;
}

function ensureQuoteCanBePaid(quote) {
  if (quote.status !== "accepted") {
    throw new AppError(409, "QUOTE_NOT_ACCEPTED", "The final quote must be accepted before payment");
  }
  if (quote.paymentMethod !== "razorpay") {
    throw new AppError(409, "ONLINE_PAYMENT_NOT_SELECTED", "Admin has not selected online payment for this quote");
  }
}

async function acquirePaymentInitialization(quote) {
  const amountMinor = toAmountMinor(quote.total);
  const currency = String(quote.currency || "INR").toUpperCase();
  const initializationKey = randomUUID();
  const initializationStartedAt = new Date();
  const base = {
    quote: quote._id,
    amount: quote.total,
    amountMinor,
    currency,
    orderSnapshot: buildOrderSnapshot(quote),
    status: "initializing",
    initializationKey,
    initializationStartedAt,
  };

  let payment = await Payment.findOne({ quote: quote._id }).select("+initializationKey +orderSnapshot");
  if (!payment) {
    try {
      return { payment: await Payment.create(base), acquired: true };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      payment = await Payment.findOne({ quote: quote._id }).select("+initializationKey +orderSnapshot");
    }
  }

  if (payment.status === "captured") return { payment, acquired: false, alreadyPaid: true };
  if (payment.status === "refunded") {
    throw new AppError(409, "PAYMENT_REFUNDED", "This paid order has been refunded; contact support before paying again");
  }
  if (["created", "authorized"].includes(payment.status) && payment.razorpayOrderId) {
    if ((payment.amountMinor || toAmountMinor(payment.amount)) !== amountMinor || payment.currency !== currency) {
      throw new AppError(409, "PAYMENT_AMOUNT_LOCKED", "The quote changed after payment started; contact support before continuing");
    }
    return { payment, acquired: false };
  }

  const staleBefore = new Date(Date.now() - INITIALIZATION_TIMEOUT_MS);
  const canClaim = payment.status === "failed"
    || (payment.status === "initializing" && (!payment.initializationStartedAt || payment.initializationStartedAt <= staleBefore));
  if (!canClaim) {
    throw new AppError(409, "PAYMENT_INITIALIZING", "Payment checkout is already being prepared; please retry in a moment");
  }

  const claimed = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      $or: [
        { status: "failed" },
        { status: "initializing", initializationStartedAt: { $lte: staleBefore } },
        { status: "initializing", initializationStartedAt: null },
      ],
    },
    {
      $set: base,
      $unset: {
        razorpayOrderId: 1,
        razorpayPaymentId: 1,
        verifiedAt: 1,
        capturedAt: 1,
        failureCode: 1,
        failureReason: 1,
      },
    },
    { new: true, runValidators: true },
  ).select("+initializationKey +orderSnapshot");
  if (!claimed) throw new AppError(409, "PAYMENT_INITIALIZING", "Payment checkout is already being prepared; please retry in a moment");
  return { payment: claimed, acquired: true };
}

export async function createPaymentOrder(reference, quoteToken, userId) {
  if (!razorpayEnabled) throw new AppError(503, "PAYMENTS_NOT_CONFIGURED", "Online payments are not configured");
  const quote = await getPayableQuote(reference, quoteToken, userId);
  ensureQuoteCanBePaid(quote);
  const initialization = await acquirePaymentInitialization(quote);
  if (initialization.alreadyPaid) {
    const order = await ensureOrder(initialization.payment);
    return { payment: initialization.payment, keyId: env.RAZORPAY_KEY_ID, alreadyPaid: true, order };
  }
  if (quote.expiresAt <= new Date()) {
    if (initialization.acquired) {
      await Payment.updateOne(
        { _id: initialization.payment._id, initializationKey: initialization.payment.initializationKey },
        { $set: { status: "failed", failureCode: "QUOTE_EXPIRED", failureReason: "Quote expired before checkout" }, $unset: { initializationKey: 1 } },
      );
    }
    throw new AppError(410, "QUOTE_EXPIRED", "This quote has expired");
  }
  await Quote.updateOne({ _id: quote._id, paymentStatus: { $nin: ["paid", "refunded"] } }, { $set: { paymentStatus: "processing" } });
  if (!initialization.acquired) return { payment: initialization.payment, keyId: env.RAZORPAY_KEY_ID };

  try {
    const gatewayOrder = await razorpay.orders.create({
      amount: initialization.payment.amountMinor,
      currency: initialization.payment.currency,
      receipt: `${quote.reference}-${initialization.payment.initializationKey.slice(0, 8)}`.slice(0, 40),
      notes: { quoteReference: quote.reference },
    });
    const payment = await Payment.findOneAndUpdate(
      { _id: initialization.payment._id, initializationKey: initialization.payment.initializationKey },
      {
        $set: {
          razorpayOrderId: gatewayOrder.id,
          gatewayOrderStatus: gatewayOrder.status,
          status: "created",
        },
        $addToSet: { razorpayOrderIds: gatewayOrder.id },
        $unset: { initializationKey: 1, initializationStartedAt: 1 },
      },
      { new: true, runValidators: true },
    );
    if (!payment) throw new Error("Payment initialization ownership was lost");
    return { payment, keyId: env.RAZORPAY_KEY_ID };
  } catch (error) {
    const details = gatewayErrorDetails(error);
    logger.error({ quoteReference: quote.reference, gatewayCode: details.code, gatewayDescription: details.description }, "Razorpay order creation failed");
    await Payment.updateOne(
      { _id: initialization.payment._id, initializationKey: initialization.payment.initializationKey },
      {
        $set: { status: "failed", failureCode: details.code, failureReason: details.description.slice(0, 500) },
        $unset: { initializationKey: 1, initializationStartedAt: 1 },
      },
    );
    await Quote.updateOne({ _id: quote._id, paymentStatus: { $nin: ["paid", "refunded"] } }, { $set: { paymentStatus: "failed" } });
    if (error instanceof AppError) throw error;
    throw new AppError(502, "PAYMENT_GATEWAY_UNAVAILABLE", "Secure checkout could not be prepared. Please try again");
  }
}

async function fetchCapturedPayment(paymentId, expectedPayment) {
  let gatewayPayment;
  try {
    gatewayPayment = await razorpay.payments.fetch(paymentId);
    if (gatewayPayment.status === "authorized") {
      try {
        gatewayPayment = await razorpay.payments.capture(
          paymentId,
          expectedPayment.amountMinor || toAmountMinor(expectedPayment.amount),
          expectedPayment.currency,
        );
      } catch (captureError) {
        const details = gatewayErrorDetails(captureError);
        logger.warn({ paymentId, gatewayCode: details.code, gatewayDescription: details.description }, "Razorpay capture returned an error; rechecking payment status");
        gatewayPayment = await razorpay.payments.fetch(paymentId);
      }
    }
  } catch (error) {
    const details = gatewayErrorDetails(error);
    logger.error({ paymentId, gatewayCode: details.code, gatewayDescription: details.description }, "Could not verify Razorpay payment status");
    throw new AppError(502, "PAYMENT_STATUS_UNAVAILABLE", "Payment status could not be confirmed. Your order will update automatically; please do not pay again");
  }
  if (gatewayPayment.status !== "captured") {
    throw new AppError(409, "PAYMENT_NOT_CAPTURED", "Payment is not captured yet. Your order will update automatically");
  }
  return gatewayPayment;
}

async function markCaptured(payment, gatewayPayment, eventId) {
  const capturedAt = gatewayPayment.captured_at
    ? new Date(Number(gatewayPayment.captured_at) * 1000)
    : new Date();
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: "refunded" } },
    {
      $set: {
        razorpayOrderId: gatewayPayment.order_id,
        razorpayPaymentId: gatewayPayment.id,
        status: "captured",
        verifiedAt: new Date(),
        capturedAt,
        failureCode: null,
        failureReason: null,
      },
      $addToSet: {
        razorpayOrderIds: gatewayPayment.order_id,
        ...(eventId ? { rawEventIds: eventId } : {}),
      },
    },
    { new: true, runValidators: true },
  );
  if (!updated) throw new AppError(409, "PAYMENT_REFUNDED", "This payment has already been refunded");
  const order = await ensureOrder(updated);
  return { payment: updated, order };
}

export async function verifyCheckout(input, quoteToken, userId) {
  if (!razorpayEnabled) throw new AppError(503, "PAYMENTS_NOT_CONFIGURED", "Online payments are not configured");
  const quote = await getPayableQuote(input.quoteReference, quoteToken, userId);
  ensureQuoteCanBePaid(quote);
  const payment = await Payment.findOne({
    quote: quote._id,
    $or: [
      { razorpayOrderId: input.razorpay_order_id },
      { razorpayOrderIds: input.razorpay_order_id },
    ],
  });
  if (!payment) throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment order was not created for this quote");

  const serverOrderId = [...storedGatewayOrderIds(payment)].find((id) => id === input.razorpay_order_id);
  if (!serverOrderId || !verifyCheckoutSignature(serverOrderId, input.razorpay_payment_id, input.razorpay_signature)) {
    throw new AppError(400, "INVALID_PAYMENT_SIGNATURE", "Payment verification failed");
  }
  if (payment.status === "captured" && payment.razorpayPaymentId === input.razorpay_payment_id) {
    return { payment, order: await ensureOrder(payment) };
  }

  const gatewayPayment = await fetchCapturedPayment(input.razorpay_payment_id, payment);
  validateGatewayPayment(gatewayPayment, payment, serverOrderId);
  return markCaptured(payment, gatewayPayment);
}

function webhookStatusUpdate(current, incoming, gatewayPayment) {
  const status = nextPaymentStatus(current, incoming);
  const update = { status };
  if (status === incoming && incoming !== "failed" && gatewayPayment.id) update.razorpayPaymentId = gatewayPayment.id;
  if (incoming === "authorized" && status === "authorized") update.verifiedAt = new Date();
  if (incoming === "failed") {
    update.lastFailedPaymentId = gatewayPayment.id;
    update.failureCode = gatewayPayment.error_code || "PAYMENT_FAILED";
    update.failureReason = String(gatewayPayment.error_description || "Payment attempt failed").slice(0, 500);
  }
  if (incoming === "refunded" && status === "refunded") update.refundedAt = new Date();
  return update;
}

export async function processWebhook(rawBody, signature, eventIdHeader) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) throw new AppError(503, "WEBHOOK_NOT_CONFIGURED", "Payment webhook is not configured");
  const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  if (!safeEqual(expected, signature)) throw new AppError(400, "INVALID_WEBHOOK_SIGNATURE", "Webhook signature is invalid");

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new AppError(400, "INVALID_WEBHOOK_BODY", "Webhook body is not valid JSON");
  }
  const incoming = SUPPORTED_WEBHOOKS.get(event.event);
  if (!incoming) return { ignored: true };
  const gatewayPayment = event.payload?.payment?.entity;
  const gatewayOrderId = gatewayPayment?.order_id;
  if (!gatewayOrderId) return { ignored: true };

  const eventId = String(eventIdHeader || expected).slice(0, 200);
  const payment = await Payment.findOne({
    $or: [{ razorpayOrderId: gatewayOrderId }, { razorpayOrderIds: gatewayOrderId }],
  }).select("+rawEventIds");
  if (!payment) {
    logger.warn({ gatewayOrderId, event: event.event }, "Webhook received for an unknown Razorpay order");
    return { ignored: true };
  }
  validateGatewayPayment(gatewayPayment, payment, gatewayOrderId);

  if (payment.rawEventIds?.includes(eventId)) {
    if (payment.status === "captured") await ensureOrder(payment);
    return { duplicate: true };
  }

  if (incoming === "captured") {
    if (payment.status === "refunded") {
      await Payment.updateOne({ _id: payment._id }, { $addToSet: { rawEventIds: eventId } });
      return { status: "refunded", ignored: true };
    }
    const result = await markCaptured(payment, gatewayPayment, eventId);
    return { status: result.payment.status };
  }

  const update = webhookStatusUpdate(payment.status, incoming, gatewayPayment);
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, rawEventIds: { $ne: eventId } },
    { $set: update, $addToSet: { rawEventIds: eventId } },
    { new: true, runValidators: true },
  );
  if (!updated) return { duplicate: true };

  if (updated.status === "refunded") {
    await Promise.all([
      Quote.updateOne({ _id: updated.quote }, { $set: { paymentStatus: "refunded" } }),
      Order.updateOne({ quote: updated.quote }, { $set: { paymentStatus: "refunded" } }),
    ]);
  } else if (updated.status === "failed") {
    await Quote.updateOne({ _id: updated.quote, paymentStatus: { $nin: ["paid", "refunded"] } }, { $set: { paymentStatus: "failed" } });
  } else if (updated.status === "authorized") {
    await Quote.updateOne({ _id: updated.quote, paymentStatus: { $nin: ["paid", "refunded"] } }, { $set: { paymentStatus: "processing" } });
  }
  return { status: updated.status };
}
