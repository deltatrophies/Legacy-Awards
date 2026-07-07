import { Router } from "express";
import { asyncHandler } from "../../common/middleware/asyncHandler.js";
import { authenticate, authorize, optionalAuthenticate } from "../../common/middleware/auth.js";
import { validate } from "../../common/middleware/validate.js";
import * as controller from "./category.controller.js";
import { createCategorySchema, updateCategorySchema } from "./category.schemas.js";

export const categoryRouter = Router();

categoryRouter.get("/", optionalAuthenticate, asyncHandler(controller.list));
categoryRouter.post("/", authenticate, authorize("admin"), validate(createCategorySchema), asyncHandler(controller.create));
categoryRouter.patch("/:slug", authenticate, authorize("admin"), validate(updateCategorySchema), asyncHandler(controller.update));
categoryRouter.delete("/:slug", authenticate, authorize("admin"), asyncHandler(controller.remove));
