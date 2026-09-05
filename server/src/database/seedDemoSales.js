import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { User } from "../modules/auth/user.model.js";

const demoSales = [
  { firstName: "Arjun", lastName: "Sales Demo", email: "sales1@legacyawards.dev", password: "SalesOne@123" },
  { firstName: "Neha", lastName: "Sales Demo", email: "sales2@legacyawards.dev", password: "SalesTwo@123" },
  { firstName: "Kabir", lastName: "Sales Demo", email: "sales3@legacyawards.dev", password: "SalesThree@123" },
];

async function seedDemoSales() {
  if (env.NODE_ENV === "production") throw new Error("Demo sales accounts cannot be seeded in production");
  await connectDatabase();
  for (const account of demoSales) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    await User.findOneAndUpdate(
      { email: account.email },
      {
        $set: {
          firstName: account.firstName,
          lastName: account.lastName,
          passwordHash,
          role: "sales",
          jobTitle: "Demo Sales Executive",
          developmentOnly: true,
          isActive: true,
          sessions: [],
        },
        $inc: { sessionVersion: 1 },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }
  logger.info({ accounts: demoSales.map((account) => account.email) }, "Development sales accounts are ready");
}

seedDemoSales()
  .catch((error) => { logger.error({ err: error }, "Demo sales seed failed"); process.exitCode = 1; })
  .finally(() => disconnectDatabase());
