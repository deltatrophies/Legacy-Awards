import mongoose from "mongoose";

const activitySchema = new mongoose.Schema({
  type: { type: String, required: true, maxlength: 80 },
  message: { type: String, required: true, maxlength: 500 },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  actorName: { type: String, trim: true, maxlength: 140 },
  actorRole: { type: String, trim: true, maxlength: 40 },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const orderSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  quote: { type: mongoose.Schema.Types.ObjectId, ref: "Quote", required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  assignedAt: Date,
  activity: { type: [activitySchema], default: [], select: false },
  customer: { type: mongoose.Schema.Types.Mixed, required: true },
  items: { type: [mongoose.Schema.Types.Mixed], required: true },
  subtotal: { type: Number, required: true },
  discount: { type: Number, required: true, default: 0 },
  total: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  paymentStatus: { type: String, enum: ["pending", "paid", "refunded", "failed"], default: "paid", index: true },
  paymentProvider: { type: String, enum: ["razorpay", "manual"], default: "razorpay" },
  gatewayPaymentId: String,
  paidAt: Date,
  fulfillmentStatus: { type: String, enum: ["pending", "artwork", "production", "ready", "shipped", "delivered", "cancelled"], default: "pending", index: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
  manualPaymentConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  manualPaymentConfirmedAt: Date,
}, { timestamps: true, versionKey: false });

export const Order = mongoose.model("Order", orderSchema);
