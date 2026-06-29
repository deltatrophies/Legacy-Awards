import Razorpay from "razorpay";
import { env, razorpayEnabled } from "./env.js";

export const razorpay = razorpayEnabled
  ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
  : null;
