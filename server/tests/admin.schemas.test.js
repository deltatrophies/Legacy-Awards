import { describe, expect, it } from "vitest";
import { createSalesUserSchema, updateSalesUserSchema } from "../src/modules/admin/admin.schemas.js";

describe("sales team account validation", () => {
  it("accepts strong individual sales accounts", () => {
    const value = createSalesUserSchema.parse({ firstName: "Asha", lastName: "Singh", email: "ASHA@example.com", password: "StrongPass123", role: "sales" });
    expect(value.email).toBe("asha@example.com");
    expect(value.role).toBe("sales");
  });

  it("rejects weak passwords and privileged roles", () => {
    expect(() => createSalesUserSchema.parse({ firstName: "A", lastName: "B", email: "a@example.com", password: "password", role: "sales" })).toThrow();
    expect(() => createSalesUserSchema.parse({ firstName: "A", lastName: "B", email: "a@example.com", password: "StrongPass123", role: "admin" })).toThrow();
  });

  it("requires a real update", () => {
    expect(() => updateSalesUserSchema.parse({})).toThrow();
    expect(updateSalesUserSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });
});
