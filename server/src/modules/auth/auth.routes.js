import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { authenticate } from "../../common/middleware/auth.js";
import { upload } from "../../common/middleware/upload.js";
import { validate } from "../../common/middleware/validate.js";
import * as controller from "./auth.controller.js";
import { loginSchema, registerSchema, updateProfileSchema } from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), asyncHandler(controller.register));
authRouter.post("/login", validate(loginSchema), asyncHandler(controller.login));
authRouter.post("/refresh", asyncHandler(controller.refresh));
authRouter.post("/logout", asyncHandler(controller.logout));
authRouter.get("/me", authenticate, asyncHandler(controller.me));
authRouter.patch("/me", authenticate, validate(updateProfileSchema), asyncHandler(controller.updateMe));
authRouter.patch("/me/avatar", authenticate, upload.single("file"), asyncHandler(controller.updateAvatar));
