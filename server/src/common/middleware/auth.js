import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../errors/AppError.js";

export function authenticate(req, _res, next) {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(new AppError(401, "AUTH_REQUIRED", "Authentication is required"));

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
    req.auth = { userId: payload.sub, role: payload.role };
    return next();
  } catch {
    return next(new AppError(401, "INVALID_TOKEN", "The access token is invalid or expired"));
  }
}

export function optionalAuthenticate(req, _res, next) {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
    req.auth = { userId: payload.sub, role: payload.role };
  } catch {
    // Public endpoints remain usable when a stale optional token is supplied.
  }
  return next();
}

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) {
    return next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action"));
  }
  return next();
};
