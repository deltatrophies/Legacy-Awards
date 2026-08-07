import { getDatabaseStatus } from "../../config/database.js";
import { env } from "../../config/env.js";

export function databaseAvailability(req, res, next) {
  if (env.NODE_ENV === "test") return next();

  const database = getDatabaseStatus();
  if (database.connected) return next();

  return res.status(503).json({
    success: false,
    error: {
      code: "DATABASE_UNAVAILABLE",
      message: "Database is not connected. Check MongoDB Atlas IP access or MONGODB_URI.",
      details: database,
    },
    requestId: req.id,
  });
}
