import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 500, default: "" },
  imageUrl: { type: String, trim: true, maxlength: 1000, default: "" },
  sortOrder: { type: Number, default: 0, index: true },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true, versionKey: false });

export const Category = mongoose.model("Category", categorySchema);
