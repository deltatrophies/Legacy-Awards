import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { validate } from "../../common/middleware/validate.js";
import * as controller from "./payment.controller.js";
import { createPaymentSchema, verifyPaymentSchema } from "./payment.schemas.js";

export const paymentRouter = Router();
paymentRouter.post("/orders", validate(createPaymentSchema), asyncHandler(controller.create));
paymentRouter.post("/verify", validate(verifyPaymentSchema), asyncHandler(controller.verify));
