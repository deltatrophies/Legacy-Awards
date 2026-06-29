import { cloudinary } from "../../config/cloudinary.js";
import { cloudinaryEnabled } from "../../config/env.js";
import { AppError } from "../../common/errors/AppError.js";

export function uploadBuffer(file, folder = "legacy-trophies/uploads") {
  if (!cloudinaryEnabled) {
    throw new AppError(503, "UPLOADS_NOT_CONFIGURED", "Cloud uploads are not configured");
  }
  return new Promise((resolve, reject) => {
    const resourceType = file.mimetype === "application/pdf" ? "raw" : "image";
    const stream = cloudinary.uploader.upload_stream({
      folder,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    }, (error, result) => {
      if (error) return reject(new AppError(502, "UPLOAD_FAILED", "The file could not be uploaded"));
      return resolve({
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        bytes: result.bytes,
        format: result.format,
      });
    });
    stream.end(file.buffer);
  });
}
