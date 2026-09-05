import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";
import { validate } from "../../common/middleware/validate.js";
import * as controller from "./order.controller.js";
import { updateOrderSchema } from "./order.schemas.js";

export const orderRouter = Router();
orderRouter.get("/public/by-quote/:reference", asyncHandler(controller.getPublicByQuote));
orderRouter.get("/mine", authenticate, asyncHandler(controller.listMine));
orderRouter.get("/mine/:id", authenticate, asyncHandler(controller.getMine));

orderRouter.use(authenticate, authorize("staff", "admin"));
orderRouter.get("/", asyncHandler(controller.list));
orderRouter.get("/:id", asyncHandler(controller.getOne));
orderRouter.patch("/:id", validate(updateOrderSchema), asyncHandler(controller.update));
