import { AppError } from "../../common/errors/AppError.js";

export function ensureCustomerActionable(quote, now = new Date()) {
  if (["paid", "refunded"].includes(quote.paymentStatus)) {
    throw new AppError(409, "QUOTE_FINALIZED", "This quotation has already been finalized");
  }
  if (!["quoted", "accepted"].includes(quote.status)) {
    throw new AppError(409, "QUOTE_NOT_READY", "This quote is not ready for a customer decision yet");
  }
  if (quote.expiresAt <= now) throw new AppError(410, "QUOTE_EXPIRED", "This quote has expired");
}

export async function acceptCustomerQuote(quote, now = new Date()) {
  if (quote.status === "accepted" && quote.customerDecision === "accepted") return quote;
  ensureCustomerActionable(quote, now);
  quote.status = "accepted";
  quote.customerDecision = "accepted";
  quote.customerDecisionAt = now;
  quote.activity = [...(quote.activity || []), {
    type: "customer_accepted",
    message: "Customer accepted the quotation.",
    actorName: quote.customer?.name || "Customer",
    actorRole: "customer",
    createdAt: now,
  }].slice(-200);
  await quote.save();
  return quote;
}

export async function requestCustomerSalesContact(quote, channel, now = new Date()) {
  ensureCustomerActionable(quote, now);
  if (quote.customerDecision !== "accepted") {
    if (quote.customerDecision !== "sales_requested") quote.customerDecisionAt = now;
    quote.customerDecision = "sales_requested";
  }
  quote.salesContactRequestedAt = quote.salesContactRequestedAt || now;
  if (channel) {
    quote.salesContactChannel = channel;
    quote.salesContactChannelSelectedAt = now;
  }
  quote.activity = [...(quote.activity || []), {
    type: "sales_contact_requested",
    message: channel ? `Customer requested sales contact by ${channel === "call" ? "phone" : "WhatsApp"}.` : "Customer requested help from the sales team.",
    actorName: quote.customer?.name || "Customer",
    actorRole: "customer",
    createdAt: now,
  }].slice(-200);
  await quote.save();
  return quote;
}

export function prepareAdminQuoteUpdate(current, input, now = new Date()) {
  const update = { ...input };
  if (["processing", "paid", "refunded"].includes(current?.paymentStatus)) {
    const changesLockedQuote = Object.keys(update).some((key) => key !== "internalNotes");
    if (changesLockedQuote) {
      throw new AppError(409, "QUOTE_FINALIZED", current.paymentStatus === "processing"
        ? "Online payment has started; only private notes can be changed"
        : "A paid quotation is locked; manage the confirmed order instead");
    }
  }
  const includesQuotedPrice = update.subtotal != null || update.discount != null || update.total != null;
  const changesPaymentRoute = update.paymentMethod != null && update.paymentMethod !== current?.paymentMethod;
  if (["processing", "paid", "refunded"].includes(current?.paymentStatus) && (includesQuotedPrice || changesPaymentRoute)) {
    throw new AppError(409, "PAYMENT_ALREADY_STARTED", "Price and payment method cannot change after online payment has started");
  }
  if (includesQuotedPrice && ["submitted", "reviewing"].includes(update.status)) update.status = "quoted";

  if (update.status === "accepted" && current?.status !== "accepted" && current?.customerDecision !== "accepted") {
    throw new AppError(409, "CUSTOMER_ACCEPTANCE_REQUIRED", "Only the customer can accept a quotation");
  }

  if (update.paymentMethod != null) {
    const nextStatus = update.status ?? current?.status;
    const hasCustomerAcceptance = current?.customerDecision === "accepted"
      || (current?.status === "accepted" && !current?.customerDecisionAt);
    if (nextStatus !== "accepted" || !hasCustomerAcceptance) {
      throw new AppError(409, "QUOTE_NOT_ACCEPTED", "Payment method can only be selected after the customer accepts the quote");
    }
    if (update.paymentMethod !== current.paymentMethod) update.paymentMethodSelectedAt = now;
  }

  return update;
}
