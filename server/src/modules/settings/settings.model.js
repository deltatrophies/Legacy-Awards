import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: "site" },
  businessName: { type: String, trim: true, maxlength: 120, default: "Legacy Awards" },
  email: { type: String, trim: true, lowercase: true, maxlength: 254, default: "orders@legacyawards.in" },
  phone: { type: String, trim: true, maxlength: 30, default: "" },
  whatsapp: { type: String, trim: true, maxlength: 20, default: "91XXXXXXXXXX" },
  address: { type: String, trim: true, maxlength: 500, default: "B-14, Okhla Phase II, New Delhi - 110020" },
  timings: { type: String, trim: true, maxlength: 160, default: "Mon-Sat, 10:00 AM - 7:00 PM" },
  mapUrl: { type: String, trim: true, maxlength: 1000, default: "" },
  instagramUrl: { type: String, trim: true, maxlength: 1000, default: "" },
  facebookUrl: { type: String, trim: true, maxlength: 1000, default: "" },
}, { timestamps: true, versionKey: false });

export const Settings = mongoose.model("Settings", settingsSchema);
