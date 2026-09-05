import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { authenticate, authorize, optionalAuthenticate } from "../../common/middleware/auth.js";
import { validate } from "../../common/middleware/validate.js";
import * as controller from "./payment.controller.js";
import { createPaymentSchema, verifyPaymentSchema } from "./payment.schemas.js";

export const paymentRouter = Router();
paymentRouter.post("/orders", optionalAuthenticate, validate(createPaymentSchema), asyncHandler(controller.create));
paymentRouter.post("/verify", optionalAuthenticate, validate(verifyPaymentSchema), asyncHandler(controller.verify));
paymentRouter.post("/reconcile", optionalAuthenticate, validate(createPaymentSchema), asyncHandler(controller.reconcile));
paymentRouter.post("/manual/:quoteId/confirm", authenticate, authorize("sales", "sales_manager", "staff", "admin"), asyncHandler(controller.confirmManual));
