import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { Order } from "../modules/orders/order.model.js";
import { ensurePaymentIndexes } from "../modules/payments/payment.model.js";

mongoose.set("strictQuery", true);

const readyStateLabels = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export async function connectDatabase() {
  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: false,
    maxPoolSize: 20,
    minPoolSize: env.NODE_ENV === "production" ? 2 : 0,
    serverSelectionTimeoutMS: 10_000,
  });
  // These uniqueness constraints are part of payment correctness, so production
  // creates them explicitly even though general automatic indexing is disabled.
  try {
    await Promise.all([ensurePaymentIndexes(), Order.createIndexes()]);
  } catch (error) {
    await mongoose.disconnect().catch(() => {});
    throw error;
  }
  logger.info("MongoDB connected");
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

export function getDatabaseStatus() {
  return {
    connected: isDatabaseConnected(),
    state: readyStateLabels[mongoose.connection.readyState] || "unknown",
  };
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
