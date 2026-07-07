import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";
import { validate } from "../../common/middleware/validate.js";
import * as controller from "./quote.controller.js";
import { createQuoteSchema, updateQuoteStatusSchema } from "./quote.schemas.js";

export const quoteRouter = Router();

quoteRouter.post("/", authenticate, validate(createQuoteSchema), asyncHandler(controller.create));
quoteRouter.get("/public/:reference", asyncHandler(controller.getPublic));
quoteRouter.get("/mine", authenticate, asyncHandler(controller.listMine));
quoteRouter.get("/", authenticate, authorize("staff", "admin"), asyncHandler(controller.listAdmin));
quoteRouter.patch("/:id/status", authenticate, authorize("staff", "admin"), validate(updateQuoteStatusSchema), asyncHandler(controller.updateStatus));
