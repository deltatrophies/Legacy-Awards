import { afterEach, describe, expect, it, vi } from "vitest";
import { Settings } from "../src/modules/settings/settings.model.js";
import { User } from "../src/modules/auth/user.model.js";
import { SalesAssignmentCursor } from "../src/modules/sales/salesAssignment.model.js";
import { applyAutomaticAssignment } from "../src/modules/quotes/quote.service.js";

afterEach(() => vi.restoreAllMocks());

describe("automatic sales assignment", () => {
  it("uses the atomic sequence to distribute leads in stable round-robin order", async () => {
    vi.spyOn(Settings, "findOne").mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ salesAssignmentMode: "round_robin" }) }),
    });
    const salespeople = [
      { _id: "507f1f77bcf86cd799439011", firstName: "Sales", lastName: "One" },
      { _id: "507f1f77bcf86cd799439012", firstName: "Sales", lastName: "Two" },
    ];
    vi.spyOn(User, "find").mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(salespeople) }),
      }),
    });
    vi.spyOn(SalesAssignmentCursor, "findOneAndUpdate").mockResolvedValue({ sequence: 2 });
    const quote = { reference: "LAQ-TEST", activity: [], save: vi.fn().mockResolvedValue(undefined) };

    await applyAutomaticAssignment(quote);

    expect(quote.assignedTo).toBe(salespeople[1]._id);
    expect(quote.activity.at(-1)).toEqual(expect.objectContaining({ type: "lead_auto_assigned" }));
    expect(quote.save).toHaveBeenCalledOnce();
    expect(SalesAssignmentCursor.findOneAndUpdate).toHaveBeenCalledWith(
      { key: "quotes" },
      expect.objectContaining({ $inc: { sequence: 1 } }),
      expect.objectContaining({ upsert: true }),
    );
  });
});
