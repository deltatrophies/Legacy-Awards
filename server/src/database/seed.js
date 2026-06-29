import { seedProducts as products } from "./seedData/products.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { logger } from "../config/logger.js";
import { Product } from "../modules/products/product.model.js";
import { Coupon } from "../modules/quotes/coupon.model.js";

const categoryPrefixes = { trophies: "TR", plaques: "PL", medals: "MD", crystal: "CR" };

async function seed() {
  await connectDatabase();
  const operations = products.map((product, index) => ({
    updateOne: {
      filter: { slug: product.id },
      update: {
        $setOnInsert: {
          ...product,
          slug: product.id,
          sku: `LA-${categoryPrefixes[product.category]}-${String(index + 1).padStart(4, "0")}`,
          images: [{ url: product.image, alt: product.name }],
        },
      },
      upsert: true,
    },
  }));
  const result = await Product.bulkWrite(operations);
  await Coupon.updateOne(
    { code: "LEGACY10" },
    { $setOnInsert: { code: "LEGACY10", type: "percentage", value: 10, maximumDiscount: 5000, active: true } },
    { upsert: true },
  );
  logger.info({ inserted: result.upsertedCount, existing: result.matchedCount }, "Catalog seed complete");
}

seed()
  .then(() => disconnectDatabase())
  .catch(async (error) => {
    logger.error({ err: error }, "Catalog seed failed");
    await disconnectDatabase();
    process.exitCode = 1;
  });
