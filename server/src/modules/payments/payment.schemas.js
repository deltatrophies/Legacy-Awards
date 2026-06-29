import { z } from "zod";

export const createPaymentSchema = z.object({
  quoteReference: z.string().min(1).max(40),
}).strict();

export const verifyPaymentSchema = z.object({
  quoteReference: z.string().min(1).max(40),
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();
