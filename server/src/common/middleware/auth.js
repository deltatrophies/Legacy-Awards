import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../errors/AppError.js";
import { User } from "../../modules/auth/user.model.js";

export async function authenticate(req, _res, next) {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(new AppError(401, "AUTH_REQUIRED", "Authentication is required"));

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
  } catch {
    return next(new AppError(401, "INVALID_TOKEN", "The access token is invalid or expired"));
  }

  try {
    const user = await User.findById(payload.sub).select("role isActive firstName lastName email +sessionVersion").lean();
    if (!user?.isActive) return next(new AppError(401, "ACCOUNT_DISABLED", "This account is no longer active"));
    if (Number(payload.ver || 0) !== Number(user.sessionVersion || 0)) return next(new AppError(401, "SESSION_REVOKED", "This session has been revoked"));
    req.auth = { userId: user._id.toString(), role: user.role, user };
    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(error);
  }
}

export async function optionalAuthenticate(req, _res, next) {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
  } catch {
    // Public endpoints remain usable when a stale optional token is supplied.
    return next();
  }
  try {
    const user = await User.findById(payload.sub).select("role isActive firstName lastName email +sessionVersion").lean();
    if (user?.isActive && Number(payload.ver || 0) === Number(user.sessionVersion || 0)) req.auth = { userId: user._id.toString(), role: user.role, user };
  } catch (error) {
    return next(error);
  }
  return next();
}

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) {
    return next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action"));
  }
  return next();
};
