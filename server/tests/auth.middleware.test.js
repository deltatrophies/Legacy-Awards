import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "../src/common/middleware/auth.js";
import { env } from "../src/config/env.js";
import { User } from "../src/modules/auth/user.model.js";

const requestFor = (token) => ({ get: (name) => name === "authorization" ? `Bearer ${token}` : undefined });
const userQuery = (user) => ({ select: () => ({ lean: () => Promise.resolve(user) }) });

afterEach(() => vi.restoreAllMocks());

describe("live account authorization", () => {
  it("uses the current database role instead of a stale token role", async () => {
    const token = jwt.sign({ role: "admin" }, env.JWT_ACCESS_SECRET, { subject: "507f1f77bcf86cd799439011", algorithm: "HS256" });
    vi.spyOn(User, "findById").mockReturnValue(userQuery({ _id: "507f1f77bcf86cd799439011", role: "sales", isActive: true, firstName: "Asha", sessionVersion: 0 }));
    const req = requestFor(token);
    const next = vi.fn();
    await authenticate(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.auth.role).toBe("sales");
  });

  it("invalidates access immediately when an account is disabled", async () => {
    const token = jwt.sign({ role: "sales" }, env.JWT_ACCESS_SECRET, { subject: "507f1f77bcf86cd799439011", algorithm: "HS256" });
    vi.spyOn(User, "findById").mockReturnValue(userQuery({ _id: "507f1f77bcf86cd799439011", role: "sales", isActive: false }));
    const next = vi.fn();
    await authenticate(requestFor(token), {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401, code: "ACCOUNT_DISABLED" });
  });

  it("invalidates old access tokens after a password or permission reset", async () => {
    const token = jwt.sign({ role: "sales", ver: 0 }, env.JWT_ACCESS_SECRET, { subject: "507f1f77bcf86cd799439011", algorithm: "HS256" });
    vi.spyOn(User, "findById").mockReturnValue(userQuery({ _id: "507f1f77bcf86cd799439011", role: "sales", isActive: true, sessionVersion: 1 }));
    const next = vi.fn();
    await authenticate(requestFor(token), {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401, code: "SESSION_REVOKED" });
  });
});
