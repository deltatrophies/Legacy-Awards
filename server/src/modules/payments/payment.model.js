import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  quote: { type: mongoose.Schema.Types.ObjectId, ref: "Quote", required: true },
  razorpayOrderId: { type: String, sparse: true, unique: true, index: true },
  razorpayOrderIds: { type: [String], default: [] },
  razorpayPaymentId: { type: String, sparse: true, unique: true },
  amount: { type: Number, required: true, min: 0 },
  amountMinor: { type: Number, required: true, min: 1 },
  currency: { type: String, default: "INR" },
  status: { type: String, enum: ["initializing", "created", "authorized", "captured", "failed", "refunded"], default: "initializing", index: true },
  initializationKey: { type: String, select: false },
  initializationStartedAt: Date,
  orderSnapshot: { type: mongoose.Schema.Types.Mixed, required: true, select: false },
  verifiedAt: Date,
  capturedAt: Date,
  refundedAt: Date,
  gatewayOrderStatus: String,
  lastFailedPaymentId: String,
  failureCode: String,
  failureReason: String,
  rawEventIds: { type: [String], default: [], select: false },
}, { timestamps: true, versionKey: false });

paymentSchema.index({ razorpayOrderIds: 1 });
paymentSchema.index({ quote: 1 }, { unique: true, name: "unique_payment_per_quote" });

export const Payment = mongoose.model("Payment", paymentSchema);

export async function ensurePaymentIndexes() {
  let indexes = [];
  try {
    indexes = await Payment.collection.indexes();
  } catch (error) {
    if (error?.codeName !== "NamespaceNotFound" && error?.code !== 26) throw error;
  }
  const legacyOrderIndex = indexes.find((index) => index.name === "razorpayOrderId_1");
  if (legacyOrderIndex && !legacyOrderIndex.sparse) {
    await Payment.collection.dropIndex(legacyOrderIndex.name);
  }
  await Payment.createIndexes();
}
