import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";
import { validate } from "../../common/middleware/validate.js";
import * as controller from "./product.controller.js";
import { createProductSchema, updateProductSchema } from "./product.schemas.js";

export const productRouter = Router();

productRouter.get("/", asyncHandler(controller.list));
productRouter.get("/:slug", asyncHandler(controller.getOne));
productRouter.post("/", authenticate, authorize("admin"), validate(createProductSchema), asyncHandler(controller.create));
productRouter.patch("/:slug", authenticate, authorize("admin"), validate(updateProductSchema), asyncHandler(controller.update));
productRouter.delete("/:slug", authenticate, authorize("admin"), asyncHandler(controller.remove));
