import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("HTTP application", () => {
  it("reports health without requiring the database", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ok");
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("returns a consistent error envelope", async () => {
    const response = await request(app).get("/api/v1/not-a-route");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
    expect(response.body.requestId).toBeTruthy();
  });

  it("allows guest quote submission route to validate public payloads", async () => {
    const response = await request(app).post("/api/v1/quotes").send({});
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("blocks guest profile updates", async () => {
    const response = await request(app).patch("/api/v1/auth/me").send({ firstName: "Test", lastName: "User" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("validates sales contact channels before accessing a quote", async () => {
    const response = await request(app)
      .post("/api/v1/quotes/public/LAQ-TEST/contact-sales")
      .send({ channel: "email" });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("protects logged-in quote decisions from guests", async () => {
    const response = await request(app)
      .post("/api/v1/quotes/mine/507f1f77bcf86cd799439011/contact-sales")
      .send({ channel: "call" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });
});
