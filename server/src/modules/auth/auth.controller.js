import { AppError } from "../../common/errors/AppError.js";
import { sendData } from "../../common/utils/response.js";
import { User } from "./user.model.js";
import * as authService from "./auth.service.js";
import { uploadBuffer } from "../uploads/upload.service.js";

function sendSession(res, result, status = 200) {
  res.cookie(authService.refreshCookie.name, result.refreshToken, authService.refreshCookie.options);
  return sendData(res, { user: result.user.toSafeObject(), accessToken: result.accessToken }, status);
}

export async function register(req, res) {
  return sendSession(res, await authService.register(req.body, req.get("user-agent")), 201);
}

export async function login(req, res) {
  return sendSession(res, await authService.login(req.body, req.get("user-agent")));
}

export async function refresh(req, res) {
  const token = req.cookies[authService.refreshCookie.name];
  if (!token) throw new AppError(401, "REFRESH_TOKEN_REQUIRED", "No active session was found");
  return sendSession(res, await authService.rotateRefreshToken(token, req.get("user-agent")));
}

export async function logout(req, res) {
  await authService.revokeRefreshToken(req.cookies[authService.refreshCookie.name]);
  res.clearCookie(authService.refreshCookie.name, authService.refreshCookie.options);
  return res.status(204).send();
}

export async function me(req, res) {
  const user = await User.findById(req.auth.userId);
  if (!user || !user.isActive) throw new AppError(404, "USER_NOT_FOUND", "User was not found");
  return sendData(res, user.toSafeObject());
}

export async function updateMe(req, res) {
  const user = await authService.updateProfile(req.auth.userId, req.body);
  return sendData(res, user.toSafeObject());
}

export async function updateAvatar(req, res) {
  if (!req.file) throw new AppError(400, "FILE_REQUIRED", "Choose a profile photo to upload");
  if (!["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)) {
    throw new AppError(415, "UNSUPPORTED_FILE", "Only JPG, PNG, and WebP profile photos are supported");
  }
  const uploaded = await uploadBuffer(req.file, "legacy-trophies/profile-photos");
  const user = await authService.updateAvatar(req.auth.userId, uploaded);
  return sendData(res, user.toSafeObject());
}
