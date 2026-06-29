import { AppError } from "../errors/AppError.js";

export const validate = (schema, source = "body") => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return next(new AppError(422, "VALIDATION_ERROR", "Request validation failed", details));
  }
  req[source] = result.data;
  return next();
};
