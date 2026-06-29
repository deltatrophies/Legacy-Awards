import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import hpp from "hpp";
import pinoHttp from "pino-http";
import { errorHandler, notFoundHandler } from "./common/middleware/errorHandler.js";
import { rejectUnsafeMongoKeys } from "./common/middleware/security.js";
import { env, isProduction } from "./config/env.js";
import { logger } from "./config/logger.js";
import { webhook } from "./modules/payments/payment.controller.js";
import { asyncHandler } from "./common/middleware/asyncHandler.js";
import { apiRouter } from "./routes/index.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = req.headers["x-request-id"] || randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
}));
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    const allowed = env.APP_ORIGIN.split(",").map((item) => item.trim());
    if (!origin || allowed.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));
app.use(compression());

// Razorpay requires the exact bytes; this route must precede JSON parsing.
app.post("/api/v1/payments/webhook", express.raw({ type: "application/json", limit: "256kb" }), asyncHandler(webhook));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());
app.use(hpp());
app.use(rejectUnsafeMongoKeys);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 10_000 : 500,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 10_000 : 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many attempts; please try again later" } },
});

app.get("/api/health", (_req, res) => res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } }));
app.use("/api/v1/auth", sensitiveLimiter);
app.use("/api/v1/inquiries", sensitiveLimiter);
app.use("/api/v1/uploads", sensitiveLimiter);
app.use("/api/v1", apiLimiter, apiRouter);

if (isProduction) {
  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
  app.use(express.static(directory, { maxAge: "1y", immutable: true }));
  app.get("/*splat", (_req, res) => res.sendFile(path.join(directory, "index.html")));
}

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
