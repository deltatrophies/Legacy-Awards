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

  it("blocks guest quote submission", async () => {
    const response = await request(app).post("/api/v1/quotes").send({});
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("blocks guest profile updates", async () => {
    const response = await request(app).patch("/api/v1/auth/me").send({ firstName: "Test", lastName: "User" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });
});
