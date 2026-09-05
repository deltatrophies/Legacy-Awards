import { afterEach, describe, expect, it, vi } from "vitest";
import { Order } from "../src/modules/orders/order.model.js";
import { confirmManualPayment } from "../src/modules/payments/payment.service.js";
import { Quote } from "../src/modules/quotes/quote.model.js";

const acceptedQuote = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439011",
  status: "accepted",
  customerDecision: "accepted",
  paymentMethod: "whatsapp",
  paymentStatus: "unpaid",
  customer: { name: "Test Customer", phone: "9876543210" },
  items: [{ name: "Award", quantity: 2, unitPrice: 500, lineTotal: 1000 }],
  subtotal: 1000,
  discount: 0,
  total: 1000,
  currency: "INR",
  ...overrides,
});

afterEach(() => vi.restoreAllMocks());

describe("manual payment confirmation", () => {
  it("creates an idempotent paid order and links it back to the quote", async () => {
    const quote = acceptedQuote();
    const order = { _id: "507f1f77bcf86cd799439012", reference: "LAO-TEST-100001" };
    vi.spyOn(Quote, "findById").mockResolvedValue(quote);
    const orderUpdate = vi.spyOn(Order, "findOneAndUpdate").mockResolvedValue(order);
    const quoteUpdate = vi.spyOn(Quote, "updateOne").mockResolvedValue({ acknowledged: true });

    const result = await confirmManualPayment(String(quote._id), "507f1f77bcf86cd799439013");

    expect(result.order).toBe(order);
    expect(orderUpdate).toHaveBeenCalledTimes(1);
    expect(orderUpdate.mock.calls[0][1].$set.paymentProvider).toBe("manual");
    expect(orderUpdate.mock.calls[0][1].$set.manualPaymentConfirmedBy).toBe("507f1f77bcf86cd799439013");
    expect(quoteUpdate).toHaveBeenCalledWith(
      { _id: quote._id, paymentStatus: { $ne: "refunded" } },
      { $set: expect.objectContaining({ paymentStatus: "paid", orderReference: order.reference }) },
    );
  });

  it("rejects confirmation before acceptance or for the wrong payment route", async () => {
    vi.spyOn(Quote, "findById").mockResolvedValueOnce(acceptedQuote({ status: "quoted", customerDecision: "pending" }));
    await expect(confirmManualPayment("quote-1")).rejects.toThrow(/must accept/i);

    Quote.findById.mockResolvedValueOnce(acceptedQuote({ paymentMethod: "razorpay" }));
    await expect(confirmManualPayment("quote-2")).rejects.toThrow(/manual payment is not selected/i);
  });

  it("never reopens a refunded order", async () => {
    vi.spyOn(Quote, "findById").mockResolvedValue(acceptedQuote({ paymentStatus: "refunded" }));
    await expect(confirmManualPayment("quote-3")).rejects.toThrow(/cannot be marked paid again/i);
  });

  it("retries safely if an order reference collides", async () => {
    const quote = acceptedQuote();
    const order = { _id: "507f1f77bcf86cd799439014", reference: "LAO-TEST-100002" };
    vi.spyOn(Quote, "findById").mockResolvedValue(quote);
    vi.spyOn(Order, "findOneAndUpdate")
      .mockRejectedValueOnce(Object.assign(new Error("duplicate reference"), { code: 11000 }))
      .mockResolvedValueOnce(order);
    vi.spyOn(Order, "findOne").mockResolvedValue(null);
    vi.spyOn(Quote, "updateOne").mockResolvedValue({ acknowledged: true });

    await expect(confirmManualPayment("quote-4", "507f1f77bcf86cd799439013")).resolves.toEqual(expect.objectContaining({ order }));
    expect(Order.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });
});
