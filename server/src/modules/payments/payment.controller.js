import { sendData } from "../../common/utils/response.js";
import * as paymentService from "./payment.service.js";

export async function create(req, res) {
  const result = await paymentService.createPaymentOrder(req.body.quoteReference, req.get("x-quote-token"), req.auth?.userId);
  return sendData(res, {
    keyId: result.keyId,
    gatewayOrderId: result.payment.razorpayOrderId,
    amount: result.payment.amount,
    amountMinor: result.payment.amountMinor || Math.round(result.payment.amount * 100),
    currency: result.payment.currency,
    alreadyPaid: Boolean(result.alreadyPaid),
    orderReference: result.order?.reference,
  }, result.alreadyPaid ? 200 : 201);
}

export async function verify(req, res) {
  const result = await paymentService.verifyCheckout(req.body, req.get("x-quote-token"), req.auth?.userId);
  return sendData(res, {
    paymentStatus: result.payment.status,
    orderReference: result.order.reference,
  });
}

export async function webhook(req, res) {
  await paymentService.processWebhook(req.body, req.get("x-razorpay-signature"), req.get("x-razorpay-event-id"));
  return res.status(204).send();
}
