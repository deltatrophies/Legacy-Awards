import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: String,
  alt: String,
}, { _id: false });

const productSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  sku: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  category: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, index: true },
  price: { type: Number, required: true, min: 0 },
  tag: { type: String, trim: true, maxlength: 100 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  badge: { type: String, trim: true, maxlength: 60 },
  images: { type: [imageSchema], default: [] },
  material: { type: String, trim: true },
  size: { type: String, trim: true },
  delivery: { type: String, trim: true },
  useCase: { type: String, trim: true },
  minOrder: { type: Number, min: 1, default: 1 },
  isActive: { type: Boolean, default: true, index: true },
  inventory: {
    track: { type: Boolean, default: false },
    available: { type: Number, min: 0, default: 0 },
  },
}, { timestamps: true, versionKey: false });

productSchema.index({ name: "text", description: "text", tag: "text", useCase: "text" });

export const Product = mongoose.model("Product", productSchema);
