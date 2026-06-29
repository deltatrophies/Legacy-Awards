import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { inquiryRouter } from "../modules/inquiries/inquiry.routes.js";
import { orderRouter } from "../modules/orders/order.routes.js";
import { paymentRouter } from "../modules/payments/payment.routes.js";
import { productRouter } from "../modules/products/product.routes.js";
import { quoteRouter } from "../modules/quotes/quote.routes.js";
import { uploadRouter } from "../modules/uploads/upload.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/quotes", quoteRouter);
apiRouter.use("/inquiries", inquiryRouter);
apiRouter.use("/uploads", uploadRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/orders", orderRouter);
