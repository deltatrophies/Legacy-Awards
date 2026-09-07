import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { parse } from "dotenv";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { User } from "../modules/auth/user.model.js";
import { Order } from "../modules/orders/order.model.js";
import { Payment } from "../modules/payments/payment.model.js";
import { Product } from "../modules/products/product.model.js";
import { Quote } from "../modules/quotes/quote.model.js";

const DAY = 24 * 60 * 60 * 1000;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));

function readDemoCredentials() {
  const candidates = [
    resolve(scriptDirectory, "../../../client/.env.development.local"),
    resolve(scriptDirectory, "../../../client/.env.local"),
  ];
  for (const path of candidates) {
    try {
      const values = parse(readFileSync(path));
      if (values.VITE_DEV_CUSTOMER_EMAIL && values.VITE_DEV_CUSTOMER_PASSWORD) {
        return { email: values.VITE_DEV_CUSTOMER_EMAIL.toLowerCase(), password: values.VITE_DEV_CUSTOMER_PASSWORD };
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error("Development customer credentials are missing from the client environment");
}

const accessTokenHash = () => createHash("sha256").update(randomBytes(32)).digest("hex");

function demoQuote({ reference, customerUser, customer, product, quantity, unitPrice, priority, createdAt }) {
  const item = {
    kind: "catalog",
    product: product._id,
    sku: product.sku,
    name: product.name,
    image: product.images?.[0]?.url || "",
    quantity,
    unitPrice,
    lineTotal: quantity * unitPrice,
  };
  return {
    reference,
    accessTokenHash: accessTokenHash(),
    user: customerUser._id,
    customer,
    items: [item],
    requestEstimate: item.lineTotal,
    subtotal: item.lineTotal,
    discount: 0,
    total: item.lineTotal,
    currency: "INR",
    status: "submitted",
    priority,
    customerDecision: "pending",
    paymentMethod: "pending",
    paymentStatus: "unpaid",
    expiresAt: new Date(createdAt.getTime() + 30 * DAY),
    activity: [{
      type: "quote_submitted",
      message: "Customer submitted a quote request.",
      actorName: customer.name,
      actorRole: "customer",
      createdAt,
    }],
    createdAt,
    updatedAt: createdAt,
  };
}

async function resetDemoWorkflow() {
  if (env.NODE_ENV === "production") throw new Error("Demo workflow reset is disabled in production");
  await connectDatabase();

  const credentials = readDemoCredentials();
  let customerUser = await User.findOne({ email: credentials.email });
  if (!customerUser) {
    customerUser = await User.create({
      firstName: "Dev",
      lastName: "Customer",
      email: credentials.email,
      passwordHash: await bcrypt.hash(credentials.password, 12),
      phone: "9876543210",
      role: "customer",
      developmentOnly: true,
      isActive: true,
    });
  }
  if (customerUser.role !== "customer") throw new Error("Configured development login does not belong to a customer account");

  const products = await Product.find({ isActive: true }).sort({ createdAt: 1 }).limit(4).lean();
  if (products.length < 4) throw new Error("At least four active products are required before resetting demo workflow data");

  const customer = {
    name: `${customerUser.firstName} ${customerUser.lastName}`.trim(),
    phone: customerUser.phone || "9876543210",
    email: customerUser.email,
    organization: "Legacy Demo Company",
    preference: "WhatsApp",
    notes: "Development workflow sample",
  };
  const now = new Date();
  const quotes = products.map((product, index) => demoQuote({
    reference: `LAQ-DEMO-100${index + 1}`,
    customerUser,
    customer,
    product,
    quantity: Math.max(product.minOrder || 1, 10 + index * 5),
    unitPrice: 850 + index * 125,
    priority: ["normal", "high", "urgent", "low"][index],
    createdAt: new Date(now.getTime() - (4 - index) * DAY),
  }));

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Promise.all([
        Payment.deleteMany({}, { session }),
        Order.deleteMany({}, { session }),
        Quote.deleteMany({}, { session }),
      ]);
      await Quote.create(quotes, { session, ordered: true });

      const [storedQuotes, orderCount, paymentCount] = await Promise.all([
        Quote.find({}).select("reference status assignedTo customerDecision paymentMethod paymentStatus").session(session).lean(),
        Order.countDocuments({}, { session }),
        Payment.countDocuments({}, { session }),
      ]);
      const allAreFreshSubmissions = storedQuotes.length === 4 && storedQuotes.every((quote) => (
        quote.status === "submitted"
        && !quote.assignedTo
        && quote.customerDecision === "pending"
        && quote.paymentMethod === "pending"
        && quote.paymentStatus === "unpaid"
      ));
      if (!allAreFreshSubmissions || orderCount !== 0 || paymentCount !== 0) {
        throw new Error("Demo workflow integrity verification failed");
      }
    });
  } finally {
    await session.endSession();
  }

  logger.info({ quoteCount: 4, orderCount: 0, paymentCount: 0, demoCustomer: customerUser.email }, "Submitted demo quotations reset complete");
}

resetDemoWorkflow()
  .catch((error) => { logger.error({ err: error }, "Demo workflow reset failed"); process.exitCode = 1; })
  .finally(() => disconnectDatabase());
