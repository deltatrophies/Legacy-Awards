import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";
import * as controller from "./admin.controller.js";

export const adminRouter = Router();

adminRouter.use(authenticate, authorize("admin"));
adminRouter.get("/summary", asyncHandler(controller.summary));
