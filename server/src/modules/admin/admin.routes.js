import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";
import * as controller from "./admin.controller.js";
import { validate } from "../../common/middleware/validate.js";
import { createSalesUserSchema, updateSalesUserSchema } from "./admin.schemas.js";

export const adminRouter = Router();

adminRouter.use(authenticate, authorize("admin"));
adminRouter.get("/summary", asyncHandler(controller.summary));
adminRouter.get("/team", asyncHandler(controller.listTeam));
adminRouter.post("/team", validate(createSalesUserSchema), asyncHandler(controller.createTeamMember));
adminRouter.patch("/team/:id", validate(updateSalesUserSchema), asyncHandler(controller.updateTeamMember));
