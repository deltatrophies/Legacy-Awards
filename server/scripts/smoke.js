import request from "supertest";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { app } from "../src/app.js";
import { cloudinary } from "../src/config/cloudinary.js";
import { cloudinaryEnabled } from "../src/config/env.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { Quote } from "../src/modules/quotes/quote.model.js";
import { User } from "../src/modules/auth/user.model.js";
import { Order } from "../src/modules/orders/order.model.js";

let createdQuoteId;
let createdUserId;
let createdOrderId;
const createdTeamUserIds = [];
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

  const quotePayload = {
    idempotencyKey: randomUUID(),
    customer: { name: "Smoke Test", phone: "+91 9999999999", email: "smoke@example.com", preference: "Email" },
    items: [{ kind: "catalog", productId: catalog.body.data[0].id, quantity: catalog.body.data[0].minOrder }],
  };
  const quote = await request(app).post("/api/v1/quotes").set("authorization", `Bearer ${accessToken}`).send(quotePayload);
  if (quote.status !== 201) throw new Error(`Quote check failed (${quote.status}): ${JSON.stringify(quote.body)}`);
  createdQuoteId = quote.body.data.id;
  const repeatedQuote = await request(app).post("/api/v1/quotes").set("authorization", `Bearer ${accessToken}`).send(quotePayload);
  if (repeatedQuote.status !== 200 || repeatedQuote.body.data.id !== createdQuoteId) {
    throw new Error("Quote idempotency check failed");
  }

  // Exercise the real multi-user sales boundary without depending on existing local team data.
  const teamPassword = "SmokeSales123!";
  const passwordHash = await bcrypt.hash(teamPassword, 12);
  const nonce = randomUUID();
  const teamInputs = [
    { firstName: "Smoke", lastName: "Sales A", email: `smoke-sales-a-${nonce}@example.com`, role: "sales" },
    { firstName: "Smoke", lastName: "Sales B", email: `smoke-sales-b-${nonce}@example.com`, role: "sales" },
    { firstName: "Smoke", lastName: "Manager", email: `smoke-manager-${nonce}@example.com`, role: "sales_manager" },
    { firstName: "Smoke", lastName: "Admin", email: `smoke-admin-${nonce}@example.com`, role: "admin" },
  ];
  const teamUsers = [];
  for (const input of teamInputs) {
    const teamUser = await User.create({ ...input, passwordHash, jobTitle: input.role === "sales_manager" ? "Sales Manager" : "Sales Executive" });
    createdTeamUserIds.push(teamUser._id);
    teamUsers.push(teamUser);
  }
  const loginTeamUser = async (teamUser) => {
    const response = await request(app).post("/api/v1/auth/login").send({ email: teamUser.email, password: teamPassword });
    if (response.status !== 200) throw new Error(`Sales login failed (${response.status})`);
    return response.body.data.accessToken;
  };
  const [salesAToken, salesBToken, managerToken, adminToken] = await Promise.all(teamUsers.map(loginTeamUser));

  const createdThroughAdmin = await request(app)
    .post("/api/v1/admin/team")
    .set("authorization", `Bearer ${adminToken}`)
    .send({
      firstName: "Created",
      lastName: "Through Admin",
      email: `smoke-admin-created-${nonce}@example.com`,
      password: teamPassword,
      role: "sales",
      phone: "+91 99999 99999",
      jobTitle: "Sales Executive",
    });
  if (createdThroughAdmin.status !== 201 || createdThroughAdmin.body.data.role !== "sales") {
    throw new Error(`Admin sales-account creation failed (${createdThroughAdmin.status}): ${JSON.stringify(createdThroughAdmin.body)}`);
  }
  createdTeamUserIds.push(createdThroughAdmin.body.data.id);

  // A round-robin setting may be enabled locally; isolate this smoke quote in the open queue.
  await Quote.updateOne({ _id: createdQuoteId }, { $unset: { assignedTo: 1, assignedBy: 1, assignedAt: 1 } });
  const [managerRevisionBefore, executiveRevisionBefore] = await Promise.all([
    request(app).get("/api/v1/sales/revision").set("authorization", `Bearer ${managerToken}`),
    request(app).get("/api/v1/sales/revision").set("authorization", `Bearer ${salesAToken}`),
  ]);
  if (managerRevisionBefore.status !== 200 || executiveRevisionBefore.status !== 200) throw new Error("Sales revision check failed");
  const openQueue = await request(app).get("/api/v1/quotes?view=unassigned&pipeline=open").set("authorization", `Bearer ${managerToken}`);
  if (openQueue.status !== 200 || !openQueue.body.data.some((item) => item.id === createdQuoteId)) {
    throw new Error("Manager open-queue visibility check failed");
  }

  const executiveClaimResults = await Promise.all([
    request(app).post(`/api/v1/quotes/${createdQuoteId}/claim`).set("authorization", `Bearer ${salesAToken}`),
    request(app).post(`/api/v1/quotes/${createdQuoteId}/claim`).set("authorization", `Bearer ${salesBToken}`),
  ]);
  if (executiveClaimResults.some((response) => response.status !== 403)) {
    throw new Error(`Executive self-assignment was not blocked (${executiveClaimResults.map((response) => response.status).join(", ")})`);
  }
  const executiveQueue = await request(app).get("/api/v1/quotes?view=unassigned&pipeline=open").set("authorization", `Bearer ${salesAToken}`);
  if (executiveQueue.status !== 200 || executiveQueue.body.data.some((item) => item.id === createdQuoteId)) {
    throw new Error("Executive can see an unassigned lead");
  }

  const assignment = await request(app)
    .patch(`/api/v1/quotes/${createdQuoteId}/assignment`)
    .set("authorization", `Bearer ${managerToken}`)
    .send({ assigneeId: teamUsers[0]._id.toString() });
  if (assignment.status !== 200 || assignment.body.data.assignedTo?.id !== teamUsers[0]._id.toString()) {
    throw new Error("Manager reassignment check failed");
  }
  const [managerRevisionAfter, executiveRevisionAfter] = await Promise.all([
    request(app).get("/api/v1/sales/revision").set("authorization", `Bearer ${managerToken}`),
    request(app).get("/api/v1/sales/revision").set("authorization", `Bearer ${salesAToken}`),
  ]);
  if (managerRevisionAfter.body.data?.revision === managerRevisionBefore.body.data?.revision
    || executiveRevisionAfter.body.data?.revision === executiveRevisionBefore.body.data?.revision) {
    throw new Error("Sales revision did not change after assignment");
  }
  const crossOwnerRead = await request(app).get(`/api/v1/quotes/${createdQuoteId}`).set("authorization", `Bearer ${salesBToken}`);
  if (crossOwnerRead.status !== 403) throw new Error("Cross-owner access was not blocked");

  const quoteUpdate = await request(app)
    .patch(`/api/v1/quotes/${createdQuoteId}/status`)
    .set("authorization", `Bearer ${salesAToken}`)
    .send({ status: "quoted", subtotal: 12500, discount: 500, total: 12000, customerNotes: "Smoke quote ready", internalNotes: "Private smoke note" });
  if (quoteUpdate.status !== 200 || !quoteUpdate.body.data.activity?.length) throw new Error("Assigned lead update/audit check failed");
  const customerQuote = await request(app).get(`/api/v1/quotes/mine/${createdQuoteId}`).set("authorization", `Bearer ${accessToken}`);
  if (customerQuote.status !== 200 || "internalNotes" in customerQuote.body.data || customerQuote.body.data.customerNotes !== "Smoke quote ready") {
    throw new Error("Customer quote privacy check failed");
  }

  const acceptedQuote = await request(app)
    .post(`/api/v1/quotes/mine/${createdQuoteId}/accept`)
    .set("authorization", `Bearer ${accessToken}`);
  if (acceptedQuote.status !== 200 || acceptedQuote.body.data.status !== "accepted" || acceptedQuote.body.data.customerDecision !== "accepted") {
    throw new Error(`Customer acceptance check failed (${acceptedQuote.status})`);
  }

  const manualRoute = await request(app)
    .patch(`/api/v1/quotes/${createdQuoteId}/status`)
    .set("authorization", `Bearer ${salesAToken}`)
    .send({ paymentMethod: "whatsapp" });
  if (manualRoute.status !== 200 || manualRoute.body.data.paymentMethod !== "whatsapp") {
    throw new Error(`Manual payment routing check failed (${manualRoute.status})`);
  }

  const manualPayment = await request(app)
    .post(`/api/v1/payments/manual/${createdQuoteId}/confirm`)
    .set("authorization", `Bearer ${salesAToken}`);
  if (manualPayment.status !== 200 || manualPayment.body.data.paymentStatus !== "paid" || !manualPayment.body.data.orderReference) {
    throw new Error(`Manual payment confirmation check failed (${manualPayment.status})`);
  }

  const paidOrder = await Order.findOne({ quote: createdQuoteId });
  if (!paidOrder || String(paidOrder.assignedTo) !== String(teamUsers[0]._id) || paidOrder.paymentProvider !== "manual") {
    throw new Error("Paid order ownership/provider check failed");
  }
  createdOrderId = paidOrder._id;

  const customerOrders = await request(app).get("/api/v1/orders/mine").set("authorization", `Bearer ${accessToken}`);
  if (customerOrders.status !== 200 || !customerOrders.body.data.some((item) => item.reference === manualPayment.body.data.orderReference)) {
    throw new Error("Paid order customer visibility check failed");
  }

  const crossOwnerOrderRead = await request(app).get(`/api/v1/orders/${createdOrderId}`).set("authorization", `Bearer ${salesBToken}`);
  if (crossOwnerOrderRead.status !== 403) throw new Error("Cross-owner paid-order access was not blocked");

  const paidQuoteEdit = await request(app)
    .patch(`/api/v1/quotes/${createdQuoteId}/status`)
    .set("authorization", `Bearer ${salesAToken}`)
    .send({ total: 11000 });
  if (paidQuoteEdit.status !== 409 || paidQuoteEdit.body.error?.code !== "QUOTE_FINALIZED") {
    throw new Error(`Paid quote editor lock check failed (${paidQuoteEdit.status})`);
  }

  const fulfillment = await request(app)
    .patch(`/api/v1/orders/${createdOrderId}`)
    .set("authorization", `Bearer ${salesAToken}`)
    .send({ fulfillmentStatus: "artwork" });
  if (fulfillment.status !== 200 || fulfillment.body.data.fulfillmentStatus !== "artwork") {
    throw new Error(`Fulfillment update check failed (${fulfillment.status})`);
  }

  const managerTeam = await request(app).get("/api/v1/sales/team").set("authorization", `Bearer ${managerToken}`);
  if (managerTeam.status !== 200 || managerTeam.body.data.length < 4) throw new Error("Sales manager team visibility check failed");

  if (cloudinaryEnabled) await retry(() => cloudinary.api.ping());
  process.stdout.write("Smoke checks passed: health, auth, catalog, quote idempotency, manager-only assignment, executive queue isolation, ownership privacy, acceptance, manual payment, paid-order conversion, editor lock, fulfillment, audit trail, Cloudinary.\n");
} finally {
  if (createdOrderId) await Order.deleteOne({ _id: createdOrderId });
  if (createdQuoteId) await Quote.deleteOne({ _id: createdQuoteId });
  if (createdUserId) await User.deleteOne({ _id: createdUserId });
  if (createdTeamUserIds.length) await User.deleteMany({ _id: { $in: createdTeamUserIds } });
  await disconnectDatabase();
}
