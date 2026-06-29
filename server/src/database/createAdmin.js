import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { logger } from "../config/logger.js";
import { User } from "../modules/auth/user.model.js";

const inputSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
});

async function createAdmin() {
  const input = inputSchema.parse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    firstName: process.env.ADMIN_FIRST_NAME || "Store",
    lastName: process.env.ADMIN_LAST_NAME || "Admin",
  });
  await connectDatabase();
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    existing.role = "admin";
    existing.isActive = true;
    await existing.save();
    logger.info({ email: input.email }, "Existing user promoted to admin");
    return;
  }
  await User.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 12),
    role: "admin",
  });
  logger.info({ email: input.email }, "Admin account created");
}

createAdmin()
  .catch((error) => { logger.error({ err: error }, "Admin creation failed"); process.exitCode = 1; })
  .finally(() => disconnectDatabase());
