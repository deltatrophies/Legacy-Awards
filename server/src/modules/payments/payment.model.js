import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  quote: { type: mongoose.Schema.Types.ObjectId, ref: "Quote", required: true, index: true },
  razorpayOrderId: { type: String, required: true, unique: true, index: true },
  razorpayPaymentId: { type: String, sparse: true, unique: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "INR" },
  status: { type: String, enum: ["created", "authorized", "captured", "failed", "refunded"], default: "created", index: true },
  verifiedAt: Date,
  failureReason: String,
  rawEventIds: { type: [String], default: [], select: false },
}, { timestamps: true, versionKey: false });

export const Payment = mongoose.model("Payment", paymentSchema);
