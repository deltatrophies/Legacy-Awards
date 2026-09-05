import request from "supertest";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { app } from "../src/app.js";
import { cloudinary } from "../src/config/cloudinary.js";
import { cloudinaryEnabled } from "../src/config/env.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { Quote } from "../src/modules/quotes/quote.model.js";
import { User } from "../src/modules/auth/user.model.js";

let createdQuoteId;
let createdUserId;
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
  const openQueue = await request(app).get("/api/v1/quotes?view=unassigned&pipeline=open").set("authorization", `Bearer ${salesAToken}`);
  if (openQueue.status !== 200 || !openQueue.body.data.some((item) => item.id === createdQuoteId)) {
    throw new Error("Sales open-queue visibility check failed");
  }

  const claimResults = await Promise.all([
    request(app).post(`/api/v1/quotes/${createdQuoteId}/claim`).set("authorization", `Bearer ${salesAToken}`),
    request(app).post(`/api/v1/quotes/${createdQuoteId}/claim`).set("authorization", `Bearer ${salesBToken}`),
  ]);
  if (claimResults.filter((response) => response.status === 200).length !== 1 || claimResults.filter((response) => response.status === 409).length !== 1) {
    throw new Error(`Atomic lead claim check failed (${claimResults.map((response) => response.status).join(", ")})`);
  }

  const assignment = await request(app)
    .patch(`/api/v1/quotes/${createdQuoteId}/assignment`)
    .set("authorization", `Bearer ${managerToken}`)
    .send({ assigneeId: teamUsers[0]._id.toString() });
  if (assignment.status !== 200 || assignment.body.data.assignedTo?.id !== teamUsers[0]._id.toString()) {
    throw new Error("Manager reassignment check failed");
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

  const managerTeam = await request(app).get("/api/v1/sales/team").set("authorization", `Bearer ${managerToken}`);
  if (managerTeam.status !== 200 || managerTeam.body.data.length < 4) throw new Error("Sales manager team visibility check failed");

  if (cloudinaryEnabled) await retry(() => cloudinary.api.ping());
  process.stdout.write("Smoke checks passed: health, auth, admin team creation, catalog, idempotency, atomic sales claiming, manager assignment, ownership privacy, audit trail, Cloudinary.\n");
} finally {
  if (createdQuoteId) await Quote.deleteOne({ _id: createdQuoteId });
  if (createdUserId) await User.deleteOne({ _id: createdUserId });
  if (createdTeamUserIds.length) await User.deleteMany({ _id: { $in: createdTeamUserIds } });
  await disconnectDatabase();
}
