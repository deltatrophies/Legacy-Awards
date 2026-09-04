import { describe, expect, it } from "vitest";
import { contactSalesSchema, updateQuoteSchema } from "../src/modules/quotes/quote.schemas.js";

describe("quote workflow validation", () => {
  it("accepts only supported sales contact channels", () => {
    expect(contactSalesSchema.safeParse({}).success).toBe(true);
    expect(contactSalesSchema.safeParse({ channel: "whatsapp" }).success).toBe(true);
    expect(contactSalesSchema.safeParse({ channel: "call" }).success).toBe(true);
    expect(contactSalesSchema.safeParse({ channel: "email" }).success).toBe(false);
  });

  it("accepts only supported payment routing values", () => {
    expect(updateQuoteSchema.safeParse({ paymentMethod: "pending" }).success).toBe(true);
    expect(updateQuoteSchema.safeParse({ paymentMethod: "razorpay" }).success).toBe(true);
    expect(updateQuoteSchema.safeParse({ paymentMethod: "whatsapp" }).success).toBe(true);
    expect(updateQuoteSchema.safeParse({ paymentMethod: "cash" }).success).toBe(false);
  });
});
