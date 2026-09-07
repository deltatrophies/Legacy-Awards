import { afterEach, describe, expect, it, vi } from "vitest";
import { Settings } from "../src/modules/settings/settings.model.js";
import { User } from "../src/modules/auth/user.model.js";
import { SalesAssignmentCursor } from "../src/modules/sales/salesAssignment.model.js";
import { applyAutomaticAssignment, nextRoundRobinSalesperson } from "../src/modules/quotes/quote.service.js";

afterEach(() => vi.restoreAllMocks());

describe("automatic sales assignment", () => {
  const salespeople = [
    { _id: "507f1f77bcf86cd799439011", firstName: "Sales", lastName: "One" },
    { _id: "507f1f77bcf86cd799439012", firstName: "Sales", lastName: "Two" },
    { _id: "507f1f77bcf86cd799439013", firstName: "Sales", lastName: "Three" },
  ];

  it("resumes after the last assignee even when the sequence has been paused", () => {
    expect(nextRoundRobinSalesperson(salespeople, { sequence: 91, lastAssignee: salespeople[1]._id })).toBe(salespeople[2]);
    expect(nextRoundRobinSalesperson(salespeople, { sequence: 92, lastAssignee: salespeople[2]._id })).toBe(salespeople[0]);
  });

  it("skips an inactive previous assignee without restarting the rotation", () => {
    expect(nextRoundRobinSalesperson([salespeople[0], salespeople[2]], { sequence: 8, lastAssignee: salespeople[1]._id })).toBe(salespeople[2]);
  });

  it("continues legacy sequence cursors that do not have a last assignee", () => {
    expect(nextRoundRobinSalesperson(salespeople, { sequence: 2 })).toBe(salespeople[2]);
  });

  it("atomically reserves the next active executive", async () => {
    vi.spyOn(Settings, "findOne").mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ salesAssignmentMode: "round_robin" }) }),
    });
    vi.spyOn(User, "find").mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(salespeople) }),
      }),
    });
    const reserve = vi.spyOn(SalesAssignmentCursor, "findOneAndUpdate")
      .mockResolvedValueOnce({ sequence: 1, lastAssignee: salespeople[0]._id })
      .mockResolvedValueOnce({ sequence: 2, lastAssignee: salespeople[1]._id });
    const quote = { reference: "LAQ-TEST", activity: [], save: vi.fn().mockResolvedValue(undefined) };

    await applyAutomaticAssignment(quote);

    expect(quote.assignedTo).toBe(salespeople[1]._id);
    expect(quote.activity.at(-1)).toEqual(expect.objectContaining({ type: "lead_auto_assigned" }));
    expect(quote.save).toHaveBeenCalledOnce();
    expect(reserve).toHaveBeenNthCalledWith(
      2,
      { key: "quotes", sequence: 1 },
      { $inc: { sequence: 1 }, $set: { lastAssignee: salespeople[1]._id } },
      { new: true },
    );
  });

  it("does not move the cursor while assignment mode is manual", async () => {
    vi.spyOn(Settings, "findOne").mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ salesAssignmentMode: "manual" }) }),
    });
    const reserve = vi.spyOn(SalesAssignmentCursor, "findOneAndUpdate");
    const quote = { reference: "LAQ-MANUAL", activity: [], save: vi.fn() };

    await applyAutomaticAssignment(quote);

    expect(reserve).not.toHaveBeenCalled();
    expect(quote.save).not.toHaveBeenCalled();
    expect(quote.assignedTo).toBeUndefined();
  });
});
