import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../../common/errors/AppError.js";
import { createReference } from "../../common/utils/identifiers.js";
import { paginationFrom, paginationMeta } from "../../common/utils/pagination.js";
import { sendData } from "../../common/utils/response.js";
import { uploadBuffer } from "../uploads/upload.service.js";
import { Inquiry } from "./inquiry.model.js";

const createAccessToken = () => randomBytes(32).toString("base64url");
const hashAccessToken = (accessToken) => createHash("sha256").update(accessToken).digest("hex");

const publicInquiryProjection = "reference name email phone organization type quantity event message status createdAt updatedAt";

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
  const filter = req.query.status ? { status: req.query.status } : {};
  const [inquiries, total] = await Promise.all([
    Inquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Inquiry.countDocuments(filter),
  ]);
  return sendData(res, inquiries, 200, paginationMeta(total, page, limit));
}

export async function getOne(req, res) {
  const query = /^[a-f0-9]{24}$/i.test(req.params.id) ? { _id: req.params.id } : { reference: req.params.id };
  const inquiry = await Inquiry.findOne(query).lean();
  if (!inquiry) throw new AppError(404, "INQUIRY_NOT_FOUND", "Inquiry was not found");
  return sendData(res, inquiry);
}

export async function update(req, res) {
  const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!inquiry) throw new AppError(404, "INQUIRY_NOT_FOUND", "Inquiry was not found");
  return sendData(res, inquiry);
}
