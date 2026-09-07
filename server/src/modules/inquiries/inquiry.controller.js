import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../../common/errors/AppError.js";
import { createReference } from "../../common/utils/identifiers.js";
import { paginationFrom, paginationMeta } from "../../common/utils/pagination.js";
import { sendData } from "../../common/utils/response.js";
import { uploadBuffer } from "../uploads/upload.service.js";
import { User } from "../auth/user.model.js";
import { Inquiry } from "./inquiry.model.js";

const createAccessToken = () => randomBytes(32).toString("base64url");
const hashAccessToken = (accessToken) => createHash("sha256").update(accessToken).digest("hex");

const publicInquiryProjection = "reference name email phone organization type quantity event message status createdAt updatedAt";
const inquiryQuery = (id) => /^[a-f0-9]{24}$/i.test(id) ? { _id: id } : { reference: id };
const visibilityFor = (auth) => auth.role === "admin" ? {} : { assignedTo: auth.userId };
const populateOwners = (query) => query
  .populate("assignedTo", "firstName lastName email role")
  .populate("assignedBy", "firstName lastName email role");

export async function create(req, res) {
  const attachment = req.file ? await uploadBuffer(req.file, "legacy-trophies/inquiry-attachments") : undefined;
  const accessToken = createAccessToken();
  const inquiry = await Inquiry.create({
    ...req.body,
    reference: createReference("LAI"),
    accessTokenHash: hashAccessToken(accessToken),
    ...(req.auth?.userId ? { userId: req.auth.userId } : {}),
    ...(attachment ? { attachment } : {}),
  });
  return sendData(res, { reference: inquiry.reference, accessToken, status: inquiry.status, createdAt: inquiry.createdAt }, 201);
}

export async function listMine(req, res) {
  const inquiries = await Inquiry.find({ userId: req.auth.userId })
    .select(publicInquiryProjection)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return sendData(res, inquiries);
}

export async function listPublic(req, res) {
  const requested = req.body.inquiries || [];
  const result = await Promise.all(requested.map(async ({ reference, accessToken }) => {
    const inquiry = await Inquiry.findOne({ reference }).select(`${publicInquiryProjection} +accessTokenHash`).lean();
    if (!inquiry || inquiry.accessTokenHash !== hashAccessToken(accessToken)) return null;
    const { accessTokenHash, ...safeInquiry } = inquiry;
    return safeInquiry;
  }));
  return sendData(res, result.filter(Boolean));
}

export async function list(req, res) {
  const { page, limit, skip } = paginationFrom(req.query);
  const filter = { ...visibilityFor(req.auth), ...(req.query.status ? { status: req.query.status } : {}) };
  const [inquiries, total] = await Promise.all([
    populateOwners(Inquiry.find(filter)).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Inquiry.countDocuments(filter),
  ]);
  return sendData(res, inquiries, 200, paginationMeta(total, page, limit));
}

export async function getOne(req, res) {
  const inquiry = await populateOwners(Inquiry.findOne({ ...inquiryQuery(req.params.id), ...visibilityFor(req.auth) })).lean();
  if (!inquiry) throw new AppError(404, "INQUIRY_NOT_FOUND", "Inquiry was not found");
  return sendData(res, inquiry);
}

export async function update(req, res) {
  const inquiry = await populateOwners(Inquiry.findOneAndUpdate(
    { ...inquiryQuery(req.params.id), ...visibilityFor(req.auth) },
    { $set: { status: req.body.status } },
    { new: true, runValidators: true },
  ));
  if (!inquiry) throw new AppError(404, "INQUIRY_NOT_FOUND", "Inquiry was not found");
  return sendData(res, inquiry);
}

export async function assign(req, res) {
  const inquiry = await Inquiry.findOne(inquiryQuery(req.params.id));
  if (!inquiry) throw new AppError(404, "INQUIRY_NOT_FOUND", "Inquiry was not found");
  let assignee = null;
  if (req.body.assigneeId) {
    assignee = await User.findOne({ _id: req.body.assigneeId, role: { $in: ["sales", "sales_manager", "staff"] }, isActive: true });
    if (!assignee) throw new AppError(422, "INVALID_ASSIGNEE", "Choose an active sales team member");
  }
  if (String(inquiry.assignedTo || "") !== String(assignee?._id || "")) {
    inquiry.assignedTo = assignee?._id || undefined;
    inquiry.assignedBy = req.auth.userId;
    inquiry.assignedAt = assignee ? new Date() : undefined;
    inquiry.assigneeViewedAt = undefined;
    await inquiry.save();
  }
  await inquiry.populate([
    { path: "assignedTo", select: "firstName lastName email role" },
    { path: "assignedBy", select: "firstName lastName email role" },
  ]);
  return sendData(res, inquiry);
}
