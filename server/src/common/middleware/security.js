import { AppError } from "../errors/AppError.js";

function containsUnsafeKey(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => key.startsWith("$") || key.includes(".") || containsUnsafeKey(child));
}

export function rejectUnsafeMongoKeys(req, _res, next) {
  if (containsUnsafeKey(req.body) || containsUnsafeKey(req.query) || containsUnsafeKey(req.params)) {
    return next(new AppError(400, "UNSAFE_INPUT", "Request contains unsupported field names"));
  }
  return next();
}
