import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";
import { validate } from "../../common/middleware/validate.js";
import * as controller from "./settings.controller.js";
import { updateSettingsSchema } from "./settings.schemas.js";

export const settingsRouter = Router();

settingsRouter.get("/", asyncHandler(controller.getSettings));
settingsRouter.patch("/", authenticate, authorize("admin"), validate(updateSettingsSchema), asyncHandler(controller.updateSettings));
