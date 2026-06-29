import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";
import { upload } from "../../common/middleware/upload.js";
import { validate } from "../../common/middleware/validate.js";
import * as controller from "./inquiry.controller.js";
import { createInquirySchema, updateInquirySchema } from "./inquiry.schemas.js";

export const inquiryRouter = Router();

inquiryRouter.post("/", upload.single("attachment"), validate(createInquirySchema), asyncHandler(controller.create));
inquiryRouter.get("/", authenticate, authorize("staff", "admin"), asyncHandler(controller.list));
inquiryRouter.patch("/:id", authenticate, authorize("staff", "admin"), validate(updateInquirySchema), asyncHandler(controller.update));
