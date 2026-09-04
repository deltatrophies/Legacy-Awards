import { AppError } from "../../common/errors/AppError.js";

export function ensureCustomerActionable(quote, now = new Date()) {
  if (!["quoted", "accepted"].includes(quote.status)) {
    throw new AppError(409, "QUOTE_NOT_READY", "This quote is not ready for a customer decision yet");
  }
  if (quote.expiresAt <= now) throw new AppError(410, "QUOTE_EXPIRED", "This quote has expired");
}

export async function acceptCustomerQuote(quote, now = new Date()) {
  ensureCustomerActionable(quote, now);
  quote.status = "accepted";
  quote.customerDecision = "accepted";
  quote.customerDecisionAt = now;
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
  await quote.save();
  return quote;
}

export function prepareAdminQuoteUpdate(current, input, now = new Date()) {
  const update = { ...input };
  const includesQuotedPrice = update.subtotal != null || update.discount != null || update.total != null;
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
