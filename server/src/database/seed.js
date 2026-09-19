import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { logger } from "../config/logger.js";
import { Coupon } from "../modules/quotes/coupon.model.js";

async function seed() {
  await connectDatabase();
  await Coupon.updateOne(
    { code: "LEGACY10" },
    { $setOnInsert: { code: "LEGACY10", type: "percentage", value: 10, maximumDiscount: 5000, active: true } },
    { upsert: true },
  );
  logger.info("Default coupon seed complete");
}

seed()
  .then(() => disconnectDatabase())
  .catch(async (error) => {
    logger.error({ err: error }, "Catalog seed failed");
    await disconnectDatabase();
    process.exitCode = 1;
  });
