import multer from "multer";
import { AppError } from "../errors/AppError.js";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml", "application/pdf"]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      return callback(new AppError(415, "UNSUPPORTED_FILE", "Only JPG, PNG, WebP, SVG, and PDF files are supported"));
    }
    return callback(null, true);
  },
});
