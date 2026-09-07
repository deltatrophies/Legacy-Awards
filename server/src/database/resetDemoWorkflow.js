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
const activity = (type, message, actorName, actorRole, createdAt) => ({ type, message, actorName, actorRole, createdAt });

function itemFrom(product, quantity, unitPrice) {
  return {
    kind: "catalog",
    product: product._id,
    sku: product.sku,
    name: product.name,
    image: product.images?.[0]?.url || "",
    quantity,
    unitPrice,
    lineTotal: quantity * unitPrice,
  };
}

function quoteBase({ reference, customerUser, customer, product, quantity, unitPrice, createdAt }) {
  const item = itemFrom(product, quantity, unitPrice);
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
    expiresAt: new Date(createdAt.getTime() + 30 * DAY),
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

  const [products, salespeople] = await Promise.all([
    Product.find({ isActive: true }).sort({ createdAt: 1 }).limit(4).lean(),
    User.find({ role: { $in: ["sales", "sales_manager", "staff"] }, isActive: true }).sort({ role: 1, firstName: 1 }),
  ]);
  if (products.length < 4) throw new Error("At least four active products are required before resetting demo workflow data");
  if (!salespeople.length) throw new Error("At least one active sales team member is required before resetting demo workflow data");

  const customer = {
    name: `${customerUser.firstName} ${customerUser.lastName}`.trim(),
    phone: customerUser.phone || "9876543210",
    email: customerUser.email,
    organization: "Legacy Demo Company",
    preference: "WhatsApp",
    notes: "Development workflow sample",
  };
  const now = new Date();
  const executive = salespeople.find((person) => person.role === "sales") || salespeople[0];
  const manager = salespeople.find((person) => ["sales_manager", "staff"].includes(person.role)) || executive;

  const submittedAt = new Date(now.getTime() - 4 * DAY);
  const quotedAt = new Date(now.getTime() - 3 * DAY);
  const acceptedAt = new Date(now.getTime() - 2 * DAY);
  const paidAt = new Date(now.getTime() - DAY);

  const quotes = [
    {
      ...quoteBase({ reference: "LAQ-DEMO-1001", customerUser, customer, product: products[0], quantity: Math.max(products[0].minOrder || 1, 10), unitPrice: 850, createdAt: submittedAt }),
      status: "submitted",
      priority: "normal",
      customerDecision: "pending",
      paymentMethod: "pending",
      paymentStatus: "unpaid",
      activity: [activity("quote_submitted", "Customer submitted a quote request.", customer.name, "customer", submittedAt)],
    },
    {
      ...quoteBase({ reference: "LAQ-DEMO-1002", customerUser, customer, product: products[1], quantity: Math.max(products[1].minOrder || 1, 20), unitPrice: 925, createdAt: quotedAt }),
      assignedTo: executive._id,
      assignedBy: manager._id,
      assignedAt: quotedAt,
      status: "quoted",
      priority: "high",
      customerDecision: "pending",
      paymentMethod: "pending",
      paymentStatus: "unpaid",
      customerNotes: "Your demo quotation is ready for review.",
      activity: [
        activity("quote_submitted", "Customer submitted a quote request.", customer.name, "customer", quotedAt),
        activity("lead_assigned", `Assigned to ${executive.firstName} ${executive.lastName}.`, `${manager.firstName} ${manager.lastName}`, manager.role, quotedAt),
        activity("quote_updated", "Quotation price and validity were shared with the customer.", `${executive.firstName} ${executive.lastName}`, executive.role, quotedAt),
      ],
    },
    {
      ...quoteBase({ reference: "LAQ-DEMO-1003", customerUser, customer, product: products[2], quantity: Math.max(products[2].minOrder || 1, 25), unitPrice: 980, createdAt: acceptedAt }),
      assignedTo: executive._id,
      assignedBy: manager._id,
      assignedAt: acceptedAt,
      status: "accepted",
      priority: "urgent",
      customerDecision: "accepted",
      customerDecisionAt: acceptedAt,
      paymentMethod: "pending",
      paymentStatus: "unpaid",
      customerNotes: "Quotation accepted. Payment method confirmation is pending.",
      activity: [
        activity("quote_submitted", "Customer submitted a quote request.", customer.name, "customer", acceptedAt),
        activity("quote_accepted", "Customer accepted the quotation.", customer.name, "customer", acceptedAt),
      ],
    },
    {
      ...quoteBase({ reference: "LAQ-DEMO-1004", customerUser, customer, product: products[3], quantity: Math.max(products[3].minOrder || 1, 30), unitPrice: 1200, createdAt: paidAt }),
      assignedTo: executive._id,
      assignedBy: manager._id,
      assignedAt: paidAt,
      status: "accepted",
      priority: "normal",
      customerDecision: "accepted",
      customerDecisionAt: paidAt,
      paymentMethod: "whatsapp",
      paymentMethodSelectedAt: paidAt,
      paymentStatus: "paid",
      paidAt,
      orderReference: "LAO-DEMO-2001",
      customerNotes: "Payment received. Order is confirmed.",
      activity: [
        activity("quote_submitted", "Customer submitted a quote request.", customer.name, "customer", paidAt),
        activity("quote_accepted", "Customer accepted the quotation.", customer.name, "customer", paidAt),
        activity("manual_payment_confirmed", "Sales team confirmed manual payment receipt.", `${manager.firstName} ${manager.lastName}`, manager.role, paidAt),
      ],
    },
  ];

  const session = await mongoose.startSession();
  let insertedQuotes;
  let insertedOrder;
  try {
    await session.withTransaction(async () => {
      await Promise.all([
        Payment.deleteMany({}, { session }),
        Order.deleteMany({}, { session }),
        Quote.deleteMany({}, { session }),
      ]);
      insertedQuotes = await Quote.create(quotes, { session, ordered: true });
      const paidQuote = insertedQuotes.find((quote) => quote.reference === "LAQ-DEMO-1004");
      [insertedOrder] = await Order.create([{
        reference: "LAO-DEMO-2001",
        quote: paidQuote._id,
        user: customerUser._id,
        assignedTo: executive._id,
        assignedBy: manager._id,
        assignedAt: paidAt,
        customer,
        items: paidQuote.items.map((item) => item.toObject()),
        subtotal: paidQuote.subtotal,
        discount: paidQuote.discount,
        total: paidQuote.total,
        currency: "INR",
        paymentStatus: "paid",
        paymentProvider: "manual",
        paidAt,
        fulfillmentStatus: "pending",
        manualPaymentConfirmedBy: manager._id,
        manualPaymentConfirmedAt: paidAt,
        activity: [activity("order_created", "Paid order created from quotation LAQ-DEMO-1004.", `${manager.firstName} ${manager.lastName}`, manager.role, paidAt)],
        createdAt: paidAt,
        updatedAt: paidAt,
      }], { session, ordered: true });
      paidQuote.convertedOrder = insertedOrder._id;
      await paidQuote.save({ session });

      const [transactionQuoteCount, transactionOrderCount, transactionPaymentCount, linkedOrder] = await Promise.all([
        Quote.countDocuments({}, { session }),
        Order.countDocuments({}, { session }),
        Payment.countDocuments({}, { session }),
        Order.findOne({ _id: insertedOrder._id, quote: paidQuote._id, user: customerUser._id }).session(session),
      ]);
      if (transactionQuoteCount !== 4 || transactionOrderCount !== 1 || transactionPaymentCount !== 0 || !linkedOrder) {
        throw new Error("Demo workflow integrity verification failed");
      }
    });
  } finally {
    await session.endSession();
  }

  const [quoteCount, orderCount, paymentCount] = await Promise.all([
    Quote.countDocuments(),
    Order.countDocuments(),
    Payment.countDocuments(),
  ]);
  logger.info({ quoteCount, orderCount, paymentCount, demoCustomer: customerUser.email }, "Demo quote and order workflow reset complete");
}

resetDemoWorkflow()
  .catch((error) => { logger.error({ err: error }, "Demo workflow reset failed"); process.exitCode = 1; })
  .finally(() => disconnectDatabase());
