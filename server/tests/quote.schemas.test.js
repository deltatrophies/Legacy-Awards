import { describe, expect, it } from "vitest";
import { contactSalesSchema, createQuoteSchema, updateQuoteSchema } from "../src/modules/quotes/quote.schemas.js";

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

  it("requires a valid UUID when quote idempotency is supplied", () => {
    const request = {
      idempotencyKey: "8bbbaec4-76c0-4d3c-b957-6f9899cb99c8",
      customer: { name: "Test Customer", phone: "9876543210", email: "test@example.com", preference: "WhatsApp" },
      items: [{ kind: "catalog", productId: "test-product", quantity: 1 }],
    };
    expect(createQuoteSchema.safeParse(request).success).toBe(true);
    expect(createQuoteSchema.safeParse({ ...request, idempotencyKey: "reused-click" }).success).toBe(false);
    expect(createQuoteSchema.safeParse({ ...request, items: [{ ...request.items[0], quantity: 1.5 }] }).success).toBe(false);
    expect(createQuoteSchema.safeParse({ ...request, items: [{ ...request.items[0], quantity: 10001 }] }).success).toBe(false);
  });
});
