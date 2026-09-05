import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  userAgent: { type: String, default: "unknown" },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 60 },
  lastName: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  avatarUrl: { type: String, trim: true, maxlength: 1000 },
  avatarPublicId: { type: String, trim: true, maxlength: 300 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["customer", "sales", "sales_manager", "staff", "admin"], default: "customer", index: true },
  phone: { type: String, trim: true, maxlength: 20 },
  jobTitle: { type: String, trim: true, maxlength: 100 },
  developmentOnly: { type: Boolean, default: false, select: false },
  isActive: { type: Boolean, default: true },
  sessions: { type: [sessionSchema], default: [], select: false },
  sessionVersion: { type: Number, default: 0, select: false },
  lastLoginAt: Date,
}, { timestamps: true, versionKey: false });

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    firstName: this.firstName,
    lastName: this.lastName,
    email: this.email,
    avatarUrl: this.avatarUrl,
    role: this.role,
    phone: this.phone || "",
    jobTitle: this.jobTitle || "",
    isActive: this.isActive,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model("User", userSchema);
