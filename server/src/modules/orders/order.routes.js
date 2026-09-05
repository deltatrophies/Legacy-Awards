import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";
import { validate } from "../../common/middleware/validate.js";
import * as controller from "./order.controller.js";
import { assignOrderSchema, updateOrderSchema } from "./order.schemas.js";

export const orderRouter = Router();
orderRouter.get("/public/by-quote/:reference", asyncHandler(controller.getPublicByQuote));
orderRouter.get("/mine", authenticate, asyncHandler(controller.listMine));
orderRouter.get("/mine/:id", authenticate, asyncHandler(controller.getMine));

orderRouter.use(authenticate, authorize("sales", "sales_manager", "staff", "admin"));
orderRouter.get("/", asyncHandler(controller.list));
orderRouter.post("/:id/claim", authorize("sales", "sales_manager", "staff"), asyncHandler(controller.claim));
orderRouter.get("/:id", asyncHandler(controller.getOne));
orderRouter.patch("/:id/assignment", authorize("sales_manager", "staff", "admin"), validate(assignOrderSchema), asyncHandler(controller.assign));
orderRouter.patch("/:id", validate(updateOrderSchema), asyncHandler(controller.update));
