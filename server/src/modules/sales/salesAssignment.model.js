import mongoose from "mongoose";

const salesAssignmentCursorSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: "quotes" },
  sequence: { type: Number, required: true, default: 0 },
  lastAssignee: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, versionKey: false });

export const SalesAssignmentCursor = mongoose.model("SalesAssignmentCursor", salesAssignmentCursorSchema);
