import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";
import * as controller from "./sales.controller.js";

export const salesRouter = Router();

salesRouter.use(authenticate, authorize("sales", "sales_manager", "staff", "admin"));
salesRouter.get("/revision", asyncHandler(controller.revision));
salesRouter.get("/summary", asyncHandler(controller.summary));
salesRouter.get("/team", authorize("sales_manager", "staff", "admin"), asyncHandler(controller.team));
salesRouter.post("/leads/:kind/:id/viewed", asyncHandler(controller.markLeadViewed));
