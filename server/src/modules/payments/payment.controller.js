import { sendData } from "../../common/utils/response.js";
import * as paymentService from "./payment.service.js";

export async function create(req, res) {
  const result = await paymentService.createPaymentOrder(req.body.quoteReference, req.get("x-quote-token"));
  return sendData(res, {
    keyId: result.keyId,
    gatewayOrderId: result.payment.razorpayOrderId,
    amount: result.payment.amount,
    currency: result.payment.currency,
  }, 201);
}

export async function verify(req, res) {
  const result = await paymentService.verifyCheckout(req.body, req.get("x-quote-token"));
  return sendData(res, {
    paymentStatus: result.payment.status,
    orderReference: result.order.reference,
  });
}

export async function webhook(req, res) {
  await paymentService.processWebhook(req.body, req.get("x-razorpay-signature"), JSON.parse(req.body.toString("utf8")));
  return res.status(204).send();
}
