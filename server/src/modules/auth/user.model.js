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
  role: { type: String, enum: ["customer", "staff", "admin"], default: "customer", index: true },
  isActive: { type: Boolean, default: true },
  sessions: { type: [sessionSchema], default: [], select: false },
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
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model("User", userSchema);
