import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ["percentage", "fixed"], required: true },
  value: { type: Number, required: true, min: 0 },
  minimumSubtotal: { type: Number, default: 0, min: 0 },
  maximumDiscount: { type: Number, min: 0 },
  active: { type: Boolean, default: true },
  startsAt: Date,
  expiresAt: Date,
}, { timestamps: true, versionKey: false });

export const Coupon = mongoose.model("Coupon", couponSchema);
