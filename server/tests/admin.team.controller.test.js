import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteTeamMember } from "../src/modules/admin/admin.controller.js";
import { User } from "../src/modules/auth/user.model.js";
import { Inquiry } from "../src/modules/inquiries/inquiry.model.js";
import { Order } from "../src/modules/orders/order.model.js";
import { Quote } from "../src/modules/quotes/quote.model.js";

const memberId = "507f1f77bcf86cd799439011";

function findMember(member) {
  return { select: vi.fn().mockResolvedValue(member) };
}

function responseMock() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

function mockNoAssignments() {
  vi.spyOn(Quote, "countDocuments").mockResolvedValue(0);
  vi.spyOn(Inquiry, "countDocuments").mockResolvedValue(0);
  vi.spyOn(Order, "countDocuments").mockResolvedValue(0);
}

afterEach(() => vi.restoreAllMocks());

describe("sales team account deletion", () => {
  it("requires the account to be disabled first", async () => {
    vi.spyOn(User, "findOne").mockReturnValue(findMember({ _id: memberId, isActive: true }));

    await expect(deleteTeamMember({ params: { id: memberId } }, responseMock()))
      .rejects.toMatchObject({ statusCode: 409, code: "ACCOUNT_MUST_BE_DISABLED" });
  });

  it("refuses deletion while active work remains assigned", async () => {
    vi.spyOn(User, "findOne").mockReturnValue(findMember({ _id: memberId, isActive: false }));
    vi.spyOn(Quote, "countDocuments").mockResolvedValue(1);
    vi.spyOn(Inquiry, "countDocuments").mockResolvedValue(0);
    vi.spyOn(Order, "countDocuments").mockResolvedValue(0);

    await expect(deleteTeamMember({ params: { id: memberId } }, responseMock()))
      .rejects.toMatchObject({ statusCode: 409, code: "ACTIVE_ASSIGNMENTS" });
  });

  it("removes login access and personal details while preserving audit references", async () => {
    const member = {
      _id: { toString: () => memberId },
      firstName: "Asha",
      lastName: "Singh",
      email: "asha@example.com",
      phone: "9999999999",
      jobTitle: "Sales Executive",
      avatarUrl: "https://example.com/avatar.jpg",
      avatarPublicId: "avatar-id",
      passwordHash: "old-hash",
      sessions: [{ tokenHash: "old-session" }],
      sessionVersion: 2,
      isActive: false,
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(User, "findOne").mockReturnValue(findMember(member));
    mockNoAssignments();
    vi.spyOn(bcrypt, "hash").mockResolvedValue("revoked-password-hash");
    const res = responseMock();

    await deleteTeamMember({ params: { id: memberId } }, res);

    expect(member).toMatchObject({
      firstName: "Deleted",
      lastName: "Sales Account",
      email: `deleted-${memberId}@deleted.awardarts.invalid`,
      phone: undefined,
      jobTitle: "Deleted account",
      passwordHash: "revoked-password-hash",
      sessions: [],
      sessionVersion: 3,
    });
    expect(member.deletedAt).toBeInstanceOf(Date);
    expect(member.save).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: memberId, deleted: true } });
  });
});
