import { describe, expect, it } from "vitest";
import { assertSalesRecordAccess, salesVisibilityFilter } from "../src/common/utils/salesAccess.js";

const alice = { userId: "507f1f77bcf86cd799439011", role: "sales" };

describe("sales ownership access", () => {
  it("limits an executive to assigned records in every view", () => {
    expect(salesVisibilityFilter(alice, "all")).toEqual({ assignedTo: alice.userId });
    expect(salesVisibilityFilter(alice, "mine")).toEqual({ assignedTo: alice.userId });
    expect(salesVisibilityFilter(alice, "unassigned")).toEqual({ assignedTo: alice.userId });
  });

  it("allows managers to filter without restricting their all-team view", () => {
    const manager = { userId: "507f1f77bcf86cd799439012", role: "sales_manager" };
    expect(salesVisibilityFilter(manager, "all")).toEqual({});
    expect(salesVisibilityFilter(manager, "mine")).toEqual({ assignedTo: manager.userId });
    expect(salesVisibilityFilter(manager, "unassigned")).toEqual({ assignedTo: null });
  });

  it("blocks cross-owner and unassigned access for executives", () => {
    expect(() => assertSalesRecordAccess({ assignedTo: alice.userId }, alice)).not.toThrow();
    expect(() => assertSalesRecordAccess({ assignedTo: null }, alice)).toThrow(/assigned to another/i);
    expect(() => assertSalesRecordAccess({ assignedTo: "507f1f77bcf86cd799439099" }, alice)).toThrow(/assigned to another/i);
  });
});
