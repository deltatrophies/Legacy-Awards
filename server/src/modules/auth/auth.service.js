import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/AppError.js";
import { User } from "./user.model.js";

const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const refreshCookieMaxAge = 7 * 24 * 60 * 60 * 1000;

function signTokens(user) {
  const accessToken = jwt.sign(
    { role: user.role },
    env.JWT_ACCESS_SECRET,
    { algorithm: "HS256", subject: user._id.toString(), expiresIn: env.JWT_ACCESS_TTL },
  );
  const refreshToken = jwt.sign(
    { type: "refresh" },
    env.JWT_REFRESH_SECRET,
    { algorithm: "HS256", subject: user._id.toString(), expiresIn: env.JWT_REFRESH_TTL },
  );
  return { accessToken, refreshToken };
}

async function issueSession(user, userAgent) {
  const tokens = signTokens(user);
  user.sessions = (user.sessions || []).filter((session) => session.expiresAt > new Date()).slice(-4);
  user.sessions.push({
    tokenHash: hashToken(tokens.refreshToken),
    expiresAt: new Date(Date.now() + refreshCookieMaxAge),
    userAgent: userAgent?.slice(0, 300) || "unknown",
  });
  user.lastLoginAt = new Date();
  await user.save();
  return tokens;
}

export async function register(input, userAgent) {
  if (await User.exists({ email: input.email })) {
    throw new AppError(409, "EMAIL_IN_USE", "An account with this email already exists");
  }
  const user = await User.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 12),
  });
  const hydrated = await User.findById(user._id).select("+sessions");
  return { user: hydrated, ...(await issueSession(hydrated, userAgent)) };
}

export async function login(input, userAgent) {
  const user = await User.findOne({ email: input.email }).select("+passwordHash +sessions");
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  if (!user.isActive) throw new AppError(403, "ACCOUNT_DISABLED", "This account has been disabled");
  return { user, ...(await issueSession(user, userAgent)) };
}

export async function updateProfile(userId, input) {
  const user = await User.findByIdAndUpdate(
    userId,
    { firstName: input.firstName, lastName: input.lastName },
    { new: true, runValidators: true },
  );
  if (!user || !user.isActive) throw new AppError(404, "USER_NOT_FOUND", "User was not found");
  return user;
}

export async function updateAvatar(userId, uploaded) {
  const user = await User.findByIdAndUpdate(
    userId,
    { avatarUrl: uploaded.url, avatarPublicId: uploaded.publicId },
    { new: true, runValidators: true },
  );
  if (!user || !user.isActive) throw new AppError(404, "USER_NOT_FOUND", "User was not found");
  return user;
}

export async function rotateRefreshToken(token, userAgent) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
  } catch {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Your session has expired");
  }
  const user = await User.findById(payload.sub).select("+sessions");
  const tokenHash = hashToken(token);
  if (!user || !user.isActive || !user.sessions.some((session) => session.tokenHash === tokenHash)) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Your session has expired");
  }
  user.sessions = user.sessions.filter((session) => session.tokenHash !== tokenHash);
  return { user, ...(await issueSession(user, userAgent)) };
}

export async function revokeRefreshToken(token) {
  if (!token) return;
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
    await User.updateOne({ _id: payload.sub }, { $pull: { sessions: { tokenHash: hashToken(token) } } });
  } catch {
    // Logout stays idempotent for expired or malformed cookies.
  }
}

export const refreshCookie = {
  name: "legacy_refresh",
  options: {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SECURE ? "none" : "lax",
    maxAge: refreshCookieMaxAge,
    path: "/api/v1/auth",
  },
};
