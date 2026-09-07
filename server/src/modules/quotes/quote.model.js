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

const activitySchema = new mongoose.Schema({
  type: { type: String, required: true, maxlength: 80 },
  message: { type: String, required: true, maxlength: 500 },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  actorName: { type: String, trim: true, maxlength: 140 },
  actorRole: { type: String, trim: true, maxlength: 40 },
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const quoteSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  idempotencyKey: { type: String, unique: true, sparse: true, select: false },
  accessTokenHash: { type: String, required: true, select: false },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  assignedAt: Date,
  assigneeViewedAt: Date,
  priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal", index: true },
  followUpAt: { type: Date, index: true },
  lostReason: { type: String, trim: true, maxlength: 500 },
  activity: { type: [activitySchema], default: [], select: false },
  customer: { type: customerSchema, required: true },
  items: { type: [quoteItemSchema], required: true },
  requestEstimate: { type: Number, min: 0, immutable: true },
  subtotal: { type: Number, required: true, min: 0 },
  couponCode: String,
  discount: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "INR", immutable: true },
  status: { type: String, enum: ["submitted", "reviewing", "quoted", "accepted", "expired", "cancelled"], default: "submitted", index: true },
  expiresAt: { type: Date, required: true, index: true },
  customerDecision: { type: String, enum: ["pending", "accepted", "sales_requested"], default: "pending", index: true },
  customerDecisionAt: Date,
  salesContactRequestedAt: Date,
  salesContactChannel: { type: String, enum: ["whatsapp", "call"] },
  salesContactChannelSelectedAt: Date,
  paymentMethod: { type: String, enum: ["pending", "razorpay", "whatsapp"], default: "pending", index: true },
  paymentMethodSelectedAt: Date,
  paymentStatus: { type: String, enum: ["unpaid", "processing", "paid", "failed", "refunded"], default: "unpaid", index: true },
  paidAt: Date,
  convertedOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  orderReference: String,
  internalNotes: { type: String, select: false },
  customerNotes: { type: String, trim: true, default: "" },
}, { timestamps: true, versionKey: false });

export const Quote = mongoose.model("Quote", quoteSchema);
