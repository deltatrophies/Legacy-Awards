import { Router } from "express";
import { adminRouter } from "../modules/admin/admin.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { categoryRouter } from "../modules/categories/category.routes.js";
import { inquiryRouter } from "../modules/inquiries/inquiry.routes.js";
import { orderRouter } from "../modules/orders/order.routes.js";
import { paymentRouter } from "../modules/payments/payment.routes.js";
import { productRouter } from "../modules/products/product.routes.js";
import { quoteRouter } from "../modules/quotes/quote.routes.js";
import { settingsRouter } from "../modules/settings/settings.routes.js";
import { uploadRouter } from "../modules/uploads/upload.routes.js";

export const apiRouter = Router();

apiRouter.use("/admin", adminRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/quotes", quoteRouter);
apiRouter.use("/inquiries", inquiryRouter);
apiRouter.use("/uploads", uploadRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/orders", orderRouter);
apiRouter.use("/settings", settingsRouter);
