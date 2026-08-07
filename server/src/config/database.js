import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

mongoose.set("strictQuery", true);

const readyStateLabels = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export async function connectDatabase() {
  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: env.NODE_ENV !== "production",
    maxPoolSize: 20,
    minPoolSize: env.NODE_ENV === "production" ? 2 : 0,
    serverSelectionTimeoutMS: 10_000,
  });
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
