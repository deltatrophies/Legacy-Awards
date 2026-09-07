import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { authenticate, authorize, optionalAuthenticate } from "../../common/middleware/auth.js";
import { upload } from "../../common/middleware/upload.js";
import { validate } from "../../common/middleware/validate.js";
import * as controller from "./inquiry.controller.js";
import { assignInquirySchema, createInquirySchema, publicInquiryListSchema, updateInquirySchema } from "./inquiry.schemas.js";

export const inquiryRouter = Router();

inquiryRouter.post("/", optionalAuthenticate, upload.single("attachment"), validate(createInquirySchema), asyncHandler(controller.create));
inquiryRouter.get("/mine", authenticate, asyncHandler(controller.listMine));
inquiryRouter.post("/public", validate(publicInquiryListSchema), asyncHandler(controller.listPublic));
inquiryRouter.get("/", authenticate, authorize("sales", "sales_manager", "staff", "admin"), asyncHandler(controller.list));
inquiryRouter.patch("/:id/assignment", authenticate, authorize("admin"), validate(assignInquirySchema), asyncHandler(controller.assign));
inquiryRouter.get("/:id", authenticate, authorize("sales", "sales_manager", "staff", "admin"), asyncHandler(controller.getOne));
inquiryRouter.patch("/:id", authenticate, authorize("sales", "sales_manager", "staff", "admin"), validate(updateInquirySchema), asyncHandler(controller.update));
