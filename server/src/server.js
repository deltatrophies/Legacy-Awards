import http from "node:http";
import { app } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

let server;
let shuttingDown = false;

async function start() {
  await connectDatabase();
  server = http.createServer(app);
  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;
  server.keepAliveTimeout = 5_000;
  server.listen(env.PORT, () => logger.info({ port: env.PORT }, "API listening"));
}

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Graceful shutdown started");
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDatabase();
  process.exit(exitCode);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  shutdown("uncaughtException", 1);
});
process.on("unhandledRejection", (error) => {
  logger.fatal({ err: error }, "Unhandled rejection");
  shutdown("unhandledRejection", 1);
});

start().catch((error) => {
  logger.fatal({ err: error }, "API failed to start");
  process.exit(1);
});
