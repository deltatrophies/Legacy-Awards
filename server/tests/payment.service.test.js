import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { nextPaymentStatus, validateGatewayPayment, verifyCheckoutSignature } from "../src/modules/payments/payment.service.js";

describe("payment security helpers", () => {
  it("verifies checkout signatures using the server-owned order id", () => {
    const secret = "test_secret_with_sufficient_entropy";
    const signature = createHmac("sha256", secret).update("order_server|pay_123").digest("hex");
    expect(verifyCheckoutSignature("order_server", "pay_123", signature, secret)).toBe(true);
    expect(verifyCheckoutSignature("order_tampered", "pay_123", signature, secret)).toBe(false);
  });

  it("rejects mismatched gateway amount, currency and order", () => {
    const payment = { amount: 750, amountMinor: 75000, currency: "INR" };
    expect(validateGatewayPayment({ order_id: "order_1", amount: 75000, currency: "INR" }, payment, "order_1")).toBe(true);
    expect(() => validateGatewayPayment({ order_id: "order_2", amount: 75000, currency: "INR" }, payment, "order_1")).toThrow(/belong/i);
    expect(() => validateGatewayPayment({ order_id: "order_1", amount: 100, currency: "INR" }, payment, "order_1")).toThrow(/amount/i);
    expect(() => validateGatewayPayment({ order_id: "order_1", amount: 75000, currency: "USD" }, payment, "order_1")).toThrow(/currency/i);
  });

  it("does not let late or duplicate webhook states downgrade a captured payment", () => {
    expect(nextPaymentStatus("captured", "failed")).toBe("captured");
    expect(nextPaymentStatus("captured", "authorized")).toBe("captured");
    expect(nextPaymentStatus("created", "failed")).toBe("created");
    expect(nextPaymentStatus("captured", "refunded")).toBe("refunded");
    expect(nextPaymentStatus("refunded", "captured")).toBe("refunded");
    expect(nextPaymentStatus("created", "refunded")).toBe("refunded");
  });
});
