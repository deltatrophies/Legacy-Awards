import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../src/app.js";
import { cloudinary } from "../src/config/cloudinary.js";
import { cloudinaryEnabled } from "../src/config/env.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { Quote } from "../src/modules/quotes/quote.model.js";
import { User } from "../src/modules/auth/user.model.js";

let createdQuoteId;
let createdUserId;
async function retry(task, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await task(); } catch (error) { lastError = error; }
  }
  throw lastError;
}

try {
  await connectDatabase();
  const health = await request(app).get("/api/health");
  if (health.status !== 200) throw new Error(`Health check failed (${health.status})`);

  const catalog = await request(app).get("/api/v1/products?limit=5");
  if (catalog.status !== 200 || catalog.body.data.length === 0) throw new Error("Catalog check failed");

  const registration = await request(app).post("/api/v1/auth/register").send({
    firstName: "Smoke",
    lastName: "Test",
    email: `smoke-${randomUUID()}@example.com`,
    password: "SmokeTest123!",
    acceptedTerms: true,
  });
  if (registration.status !== 201) throw new Error(`Auth check failed (${registration.status})`);
  createdUserId = registration.body.data.user.id;
  const accessToken = registration.body.data.accessToken;
  const me = await request(app).get("/api/v1/auth/me").set("authorization", `Bearer ${accessToken}`);
  if (me.status !== 200 || me.body.data.id !== createdUserId) throw new Error("Authenticated user check failed");

  const quote = await request(app).post("/api/v1/quotes").set("authorization", `Bearer ${accessToken}`).send({
    customer: { name: "Smoke Test", phone: "+91 9999999999", email: "smoke@example.com", preference: "Email" },
    items: [{ kind: "catalog", productId: catalog.body.data[0].id, quantity: catalog.body.data[0].minOrder }],
  });
  if (quote.status !== 201) throw new Error(`Quote check failed (${quote.status}): ${JSON.stringify(quote.body)}`);
  createdQuoteId = quote.body.data.id;

  if (cloudinaryEnabled) await retry(() => cloudinary.api.ping());
  process.stdout.write("Smoke checks passed: health, auth, MongoDB catalog, quote pricing, Cloudinary credentials.\n");
} finally {
  if (createdQuoteId) await Quote.deleteOne({ _id: createdQuoteId });
  if (createdUserId) await User.deleteOne({ _id: createdUserId });
  await disconnectDatabase();
}
