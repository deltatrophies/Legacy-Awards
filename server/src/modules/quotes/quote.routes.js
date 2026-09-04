import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { authenticate, authorize, optionalAuthenticate } from "../../common/middleware/auth.js";
import { validate } from "../../common/middleware/validate.js";
import * as controller from "./quote.controller.js";
import { contactSalesSchema, couponSchema, createQuoteSchema, trackQuoteSchema, updateCouponSchema, updateQuoteSchema, validateCouponSchema } from "./quote.schemas.js";

export const quoteRouter = Router();

quoteRouter.post("/", optionalAuthenticate, validate(createQuoteSchema), asyncHandler(controller.create));
quoteRouter.post("/track", validate(trackQuoteSchema), asyncHandler(controller.track));
quoteRouter.post("/coupons/validate", validate(validateCouponSchema), asyncHandler(controller.validateCoupon));
quoteRouter.post("/public/:reference/accept", asyncHandler(controller.acceptPublic));
quoteRouter.post("/public/:reference/contact-sales", validate(contactSalesSchema), asyncHandler(controller.contactSalesPublic));
quoteRouter.get("/public/:reference", asyncHandler(controller.getPublic));
quoteRouter.get("/custom-pricing", asyncHandler(controller.getCustomPricing));
quoteRouter.get("/mine", authenticate, asyncHandler(controller.listMine));
quoteRouter.get("/mine/:id", authenticate, asyncHandler(controller.getMine));
quoteRouter.post("/mine/:id/accept", authenticate, asyncHandler(controller.acceptMine));
quoteRouter.post("/mine/:id/contact-sales", authenticate, validate(contactSalesSchema), asyncHandler(controller.contactSalesMine));
quoteRouter.get("/coupons", authenticate, authorize("admin"), asyncHandler(controller.listCoupons));
quoteRouter.post("/coupons", authenticate, authorize("admin"), validate(couponSchema), asyncHandler(controller.createCoupon));
quoteRouter.patch("/coupons/:id", authenticate, authorize("admin"), validate(updateCouponSchema), asyncHandler(controller.updateCoupon));
quoteRouter.get("/", authenticate, authorize("staff", "admin"), asyncHandler(controller.listAdmin));
quoteRouter.get("/:id", authenticate, authorize("staff", "admin"), asyncHandler(controller.getAdmin));
quoteRouter.patch("/:id/status", authenticate, authorize("staff", "admin"), validate(updateQuoteSchema), asyncHandler(controller.updateQuote));
