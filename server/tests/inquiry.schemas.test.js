import { describe, expect, it } from "vitest";
import { assignInquirySchema, updateInquirySchema } from "../src/modules/inquiries/inquiry.schemas.js";

describe("inquiry ownership validation", () => {
  it("accepts an active-user id or an explicit unassignment", () => {
    expect(assignInquirySchema.parse({ assigneeId: "507f1f77bcf86cd799439011" })).toEqual({ assigneeId: "507f1f77bcf86cd799439011" });
    expect(assignInquirySchema.parse({ assigneeId: null })).toEqual({ assigneeId: null });
  });

  it("rejects malformed assignment payloads", () => {
    expect(() => assignInquirySchema.parse({ assigneeId: "not-an-id" })).toThrow();
    expect(() => assignInquirySchema.parse({ assigneeId: null, role: "admin" })).toThrow();
  });

  it("keeps normal inquiry updates status-only", () => {
    expect(updateInquirySchema.parse({ status: "contacted" })).toEqual({ status: "contacted" });
    expect(() => updateInquirySchema.parse({ status: "contacted", assignedTo: "507f1f77bcf86cd799439011" })).toThrow();
  });
});
