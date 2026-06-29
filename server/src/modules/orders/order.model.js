import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  quote: { type: mongoose.Schema.Types.ObjectId, ref: "Quote", required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  customer: { type: mongoose.Schema.Types.Mixed, required: true },
  items: { type: [mongoose.Schema.Types.Mixed], required: true },
  subtotal: { type: Number, required: true },
  discount: { type: Number, required: true, default: 0 },
  total: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  paymentStatus: { type: String, enum: ["pending", "paid", "refunded", "failed"], default: "paid", index: true },
  fulfillmentStatus: { type: String, enum: ["pending", "artwork", "production", "ready", "shipped", "delivered", "cancelled"], default: "pending", index: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
}, { timestamps: true, versionKey: false });

export const Order = mongoose.model("Order", orderSchema);
