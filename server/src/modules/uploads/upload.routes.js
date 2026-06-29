import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { upload } from "../../common/middleware/upload.js";
import { AppError } from "../../common/errors/AppError.js";
import { sendData } from "../../common/utils/response.js";
import { uploadBuffer } from "./upload.service.js";

export const uploadRouter = Router();

uploadRouter.post("/image", upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, "FILE_REQUIRED", "Choose a file to upload");
  const uploaded = await uploadBuffer(req.file, "legacy-trophies/customer-artwork");
  return sendData(res, uploaded, 201);
}));
