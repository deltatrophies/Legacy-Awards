import mongoose from "mongoose";

const inquirySchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  phone: { type: String, trim: true },
  organization: { type: String, required: true, trim: true },
  type: { type: String, required: true, enum: ["bulk", "custom", "pricing", "general"], index: true },
  quantity: { type: Number, min: 1 },
  event: { type: String, trim: true },
  message: { type: String, trim: true },
  attachment: {
    url: String,
    publicId: String,
    resourceType: String,
  },
  status: { type: String, enum: ["new", "contacted", "qualified", "closed", "spam"], default: "new", index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, versionKey: false });

export const Inquiry = mongoose.model("Inquiry", inquirySchema);
