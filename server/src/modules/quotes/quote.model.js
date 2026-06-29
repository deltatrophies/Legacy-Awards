import mongoose from "mongoose";

const quoteItemSchema = new mongoose.Schema({
  kind: { type: String, enum: ["catalog", "custom"], required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  sku: String,
  name: { type: String, required: true },
  image: String,
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  design: mongoose.Schema.Types.Mixed,
}, { _id: true });

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  organization: { type: String, trim: true },
  preference: { type: String, enum: ["WhatsApp", "Email", "Phone call"], default: "WhatsApp" },
  notes: { type: String, trim: true },
}, { _id: false });

const quoteSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  accessTokenHash: { type: String, required: true, select: false },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  customer: { type: customerSchema, required: true },
  items: { type: [quoteItemSchema], required: true },
  subtotal: { type: Number, required: true, min: 0 },
  couponCode: String,
  discount: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "INR", immutable: true },
  status: { type: String, enum: ["submitted", "reviewing", "quoted", "accepted", "expired", "cancelled"], default: "submitted", index: true },
  expiresAt: { type: Date, required: true, index: true },
  internalNotes: { type: String, select: false },
}, { timestamps: true, versionKey: false });

export const Quote = mongoose.model("Quote", quoteSchema);
