import { createHmac, timingSafeEqual } from "node:crypto";
import { env, razorpayEnabled } from "../../config/env.js";
import { razorpay } from "../../config/razorpay.js";
import { AppError } from "../../common/errors/AppError.js";
import { createReference } from "../../common/utils/identifiers.js";
import { Order } from "../orders/order.model.js";
import { getPublicQuote } from "../quotes/quote.service.js";
import { Payment } from "./payment.model.js";

const safeEqual = (left, right) => {
  const a = Buffer.from(left || "");
  const b = Buffer.from(right || "");
  return a.length === b.length && timingSafeEqual(a, b);
};

async function ensureOrder(payment) {
  const populatedPayment = await payment.populate("quote");
  const quote = populatedPayment.quote;
  return Order.findOneAndUpdate(
    { quote: quote._id },
    {
      $setOnInsert: {
        reference: createReference("LAO"),
        quote: quote._id,
        user: quote.user,
        customer: quote.customer.toObject?.() || quote.customer,
        items: quote.items.map((item) => item.toObject?.() || item),
        subtotal: quote.subtotal,
        discount: quote.discount,
        total: quote.total,
        currency: quote.currency,
        paymentStatus: "paid",
        payment: payment._id,
      },
    },
    { new: true, upsert: true, runValidators: true },
  );
}

export async function createPaymentOrder(reference, quoteToken) {
  if (!razorpayEnabled) throw new AppError(503, "PAYMENTS_NOT_CONFIGURED", "Online payments are not configured");
  const quote = await getPublicQuote(reference, quoteToken);
  if (quote.status !== "accepted") {
    throw new AppError(409, "QUOTE_NOT_ACCEPTED", "The final quote must be accepted before payment");
  }
  if (quote.expiresAt <= new Date()) throw new AppError(410, "QUOTE_EXPIRED", "This quote has expired");

  const existing = await Payment.findOne({ quote: quote._id, status: { $in: ["created", "authorized"] } });
  if (existing) return { payment: existing, keyId: env.RAZORPAY_KEY_ID };

  const gatewayOrder = await razorpay.orders.create({
    amount: quote.total * 100,
    currency: quote.currency,
    receipt: quote.reference,
    notes: { quoteReference: quote.reference },
  });
  const payment = await Payment.create({
    quote: quote._id,
    razorpayOrderId: gatewayOrder.id,
    amount: quote.total,
    currency: quote.currency,
  });
  return { payment, keyId: env.RAZORPAY_KEY_ID };
}

export async function verifyCheckout(input, quoteToken) {
  if (!razorpayEnabled) throw new AppError(503, "PAYMENTS_NOT_CONFIGURED", "Online payments are not configured");
  await getPublicQuote(input.quoteReference, quoteToken);
  const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
    .digest("hex");
  if (!safeEqual(expected, input.razorpay_signature)) {
    throw new AppError(400, "INVALID_PAYMENT_SIGNATURE", "Payment verification failed");
  }
  const payment = await Payment.findOneAndUpdate(
    { razorpayOrderId: input.razorpay_order_id },
    { razorpayPaymentId: input.razorpay_payment_id, status: "captured", verifiedAt: new Date() },
    { new: true },
  );
  if (!payment) throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment was not found");
  const order = await ensureOrder(payment);
  return { payment, order };
}

export async function processWebhook(rawBody, signature, event) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) throw new AppError(503, "WEBHOOK_NOT_CONFIGURED", "Payment webhook is not configured");
  const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  if (!safeEqual(expected, signature)) throw new AppError(400, "INVALID_WEBHOOK_SIGNATURE", "Webhook signature is invalid");
  const gatewayOrderId = event.payload?.payment?.entity?.order_id;
  if (!gatewayOrderId) return;
  const gatewayPayment = event.payload.payment.entity;
  const status = ["captured", "failed", "authorized", "refunded"].includes(gatewayPayment.status) ? gatewayPayment.status : undefined;
  if (!status) return;
  const eventId = event.event_id || createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const payment = await Payment.findOneAndUpdate(
    { razorpayOrderId: gatewayOrderId, rawEventIds: { $ne: eventId } },
    {
      $set: {
        status,
        razorpayPaymentId: gatewayPayment.id,
        ...(status === "captured" ? { verifiedAt: new Date() } : {}),
        ...(status === "failed" ? { failureReason: gatewayPayment.error_description } : {}),
      },
      $addToSet: { rawEventIds: eventId },
    },
    { new: true },
  ).select("+rawEventIds");
  if (payment && status === "captured") await ensureOrder(payment);
}
