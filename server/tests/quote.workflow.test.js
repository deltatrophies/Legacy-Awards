import { describe, expect, it, vi } from "vitest";
import { acceptCustomerQuote, ensureCustomerActionable, prepareAdminQuoteUpdate, requestCustomerSalesContact } from "../src/modules/quotes/quote.workflow.js";

function quoteFixture(overrides = {}) {
  return {
    status: "quoted",
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    customerDecision: "pending",
    paymentMethod: "pending",
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("quote decision workflow", () => {
  it("moves from sales assistance to acceptance without losing the sales audit trail", async () => {
    const quote = quoteFixture();
    const requestedAt = new Date("2029-01-01T10:00:00.000Z");
    const channelAt = new Date("2029-01-01T10:05:00.000Z");
    const acceptedAt = new Date("2029-01-01T10:10:00.000Z");

    await requestCustomerSalesContact(quote, undefined, requestedAt);
    expect(quote.customerDecision).toBe("sales_requested");
    expect(quote.customerDecisionAt).toBe(requestedAt);
    expect(quote.salesContactRequestedAt).toBe(requestedAt);

    await requestCustomerSalesContact(quote, "call", channelAt);
    expect(quote.customerDecisionAt).toBe(requestedAt);
    expect(quote.salesContactChannel).toBe("call");
    expect(quote.salesContactChannelSelectedAt).toBe(channelAt);

    await acceptCustomerQuote(quote, acceptedAt);
    expect(quote.status).toBe("accepted");
    expect(quote.customerDecision).toBe("accepted");
    expect(quote.customerDecisionAt).toBe(acceptedAt);
    expect(quote.salesContactRequestedAt).toBe(requestedAt);
    expect(quote.salesContactChannel).toBe("call");
  });

  it("allows payment routing only after customer acceptance", () => {
    const now = new Date("2029-01-01T11:00:00.000Z");
    const pendingQuote = quoteFixture();
    expect(() => prepareAdminQuoteUpdate(pendingQuote, { paymentMethod: "whatsapp" }, now)).toThrowError(/after the customer accepts/i);

    const acceptedQuote = quoteFixture({ status: "accepted", customerDecision: "accepted" });
    const update = prepareAdminQuoteUpdate(acceptedQuote, { paymentMethod: "whatsapp" }, now);
    expect(update.paymentMethod).toBe("whatsapp");
    expect(update.paymentMethodSelectedAt).toBe(now);
  });

  it("blocks premature admin acceptance and expired customer actions", () => {
    const quote = quoteFixture();
    expect(() => prepareAdminQuoteUpdate(quote, { status: "accepted" })).toThrowError(/only the customer/i);
    expect(() => ensureCustomerActionable(quoteFixture({ expiresAt: new Date("2028-01-01T00:00:00.000Z") }), new Date("2029-01-01T00:00:00.000Z"))).toThrowError(/expired/i);
  });

  it("automatically marks a priced draft as quoted even without a customer note", () => {
    const update = prepareAdminQuoteUpdate(quoteFixture({ status: "reviewing" }), { status: "reviewing", total: 2500, customerNotes: "" });
    expect(update.status).toBe("quoted");
    expect(update.customerNotes).toBe("");
  });

  it("locks pricing and payment routing after online payment starts", () => {
    const quote = quoteFixture({ status: "accepted", customerDecision: "accepted", paymentMethod: "razorpay", paymentStatus: "processing" });
    expect(() => prepareAdminQuoteUpdate(quote, { total: 5000 })).toThrowError(/cannot change/i);
    expect(() => prepareAdminQuoteUpdate(quote, { paymentMethod: "whatsapp" })).toThrowError(/cannot change/i);
    expect(prepareAdminQuoteUpdate(quote, { customerNotes: "Payment received soon" }).customerNotes).toBe("Payment received soon");
  });
});
