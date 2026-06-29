import { AppError } from "../../common/errors/AppError.js";
import { createReference } from "../../common/utils/identifiers.js";
import { paginationFrom, paginationMeta } from "../../common/utils/pagination.js";
import { sendData } from "../../common/utils/response.js";
import { uploadBuffer } from "../uploads/upload.service.js";
import { Inquiry } from "./inquiry.model.js";

export async function create(req, res) {
  const attachment = req.file ? await uploadBuffer(req.file, "legacy-trophies/inquiry-attachments") : undefined;
  const inquiry = await Inquiry.create({
    ...req.body,
    reference: createReference("LAI"),
    ...(attachment ? { attachment } : {}),
  });
  return sendData(res, { reference: inquiry.reference, status: inquiry.status, createdAt: inquiry.createdAt }, 201);
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

export async function update(req, res) {
  const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!inquiry) throw new AppError(404, "INQUIRY_NOT_FOUND", "Inquiry was not found");
  return sendData(res, inquiry);
}
