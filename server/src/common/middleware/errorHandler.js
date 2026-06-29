import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../errors/AppError.js";

function normalizeError(error) {
  if (error instanceof AppError) return error;
  if (error?.name === "MulterError") {
    return new AppError(413, "UPLOAD_LIMIT", "The uploaded file exceeds the 5MB limit");
  }
  if (error?.name === "ValidationError") {
    return new AppError(422, "VALIDATION_ERROR", "Stored data validation failed");
  }
  if (error?.code === 11000) {
    return new AppError(409, "DUPLICATE_RESOURCE", "A record with these details already exists");
  }
  if (error?.name === "CastError") {
    return new AppError(400, "INVALID_IDENTIFIER", "The supplied identifier is invalid");
  }
  return new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred");
}

export function notFoundHandler(req, _res, next) {
  next(new AppError(404, "ROUTE_NOT_FOUND", `Route ${req.method} ${req.originalUrl} was not found`));
}

export function errorHandler(error, req, res, _next) {
  const normalized = normalizeError(error);
  const log = normalized.statusCode >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  log({ err: error, requestId: req.id }, normalized.message);

  res.status(normalized.statusCode).json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details ? { details: normalized.details } : {}),
      ...(env.NODE_ENV === "development" && !normalized.isOperational ? { stack: error.stack } : {}),
    },
    requestId: req.id,
  });
}
