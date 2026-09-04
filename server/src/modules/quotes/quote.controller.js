import { AppError } from "../../common/errors/AppError.js";
import { paginationFrom, paginationMeta } from "../../common/utils/pagination.js";
import { sendData } from "../../common/utils/response.js";
import { Quote } from "./quote.model.js";
import { Coupon } from "./coupon.model.js";
import * as quoteService from "./quote.service.js";
import { acceptCustomerQuote, prepareAdminQuoteUpdate, requestCustomerSalesContact } from "./quote.workflow.js";

const getRequestEstimate = (quote) => {
  if (quote.requestEstimate != null) return quote.requestEstimate;
  const itemEstimate = quote.items?.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  return itemEstimate || quote.total || 0;
};

const serialize = (quote, accessToken) => ({
  id: quote._id.toString(),
  reference: quote.reference,
  ...(accessToken ? { accessToken } : {}),
  customer: quote.customer,
  items: quote.items,
  requestEstimate: getRequestEstimate(quote),
  subtotal: quote.subtotal,
  discount: quote.discount,
  total: quote.total,
  currency: quote.currency,
  status: quote.status,
  expiresAt: quote.expiresAt,
  customerDecision: quote.customerDecision === "pending" && quote.status === "accepted" ? "accepted" : quote.customerDecision || (quote.status === "accepted" ? "accepted" : "pending"),
  customerDecisionAt: quote.customerDecisionAt,
  salesContactRequestedAt: quote.salesContactRequestedAt,
  salesContactChannel: quote.salesContactChannel || "",
  salesContactChannelSelectedAt: quote.salesContactChannelSelectedAt,
  paymentMethod: quote.paymentMethod || "pending",
  paymentMethodSelectedAt: quote.paymentMethodSelectedAt,
  internalNotes: quote.internalNotes || "",
  customerNotes: quote.customerNotes || "",
  createdAt: quote.createdAt,
  updatedAt: quote.updatedAt,
});

const serializeCoupon = (coupon) => ({
  id: coupon._id.toString(),
  code: coupon.code,
  type: coupon.type,
  value: coupon.value,
  minimumSubtotal: coupon.minimumSubtotal || 0,
  maximumDiscount: coupon.maximumDiscount,
  active: coupon.active,
  startsAt: coupon.startsAt,
  expiresAt: coupon.expiresAt,
  createdAt: coupon.createdAt,
  updatedAt: coupon.updatedAt,
});

export async function create(req, res) {
  const result = await quoteService.createQuote(req.body, req.auth?.userId);
  return sendData(res, serialize(result.quote, result.accessToken), 201);
}

export async function track(req, res) {
  const result = await quoteService.trackQuote(req.body.reference, req.body.identifier);
  return sendData(res, serialize(result.quote, result.accessToken));
}

export async function validateCoupon(req, res) {
  return sendData(res, await quoteService.validateCoupon(req.body.code, req.body.subtotal));
}

export async function getPublic(req, res) {
  const quote = await quoteService.getPublicQuote(req.params.reference, req.get("x-quote-token"));
  return sendData(res, serialize(quote));
}

export async function acceptPublic(req, res) {
  const quote = await quoteService.getPublicQuote(req.params.reference, req.get("x-quote-token"));
  return sendData(res, serialize(await acceptCustomerQuote(quote)));
}

export async function contactSalesPublic(req, res) {
  const quote = await quoteService.getPublicQuote(req.params.reference, req.get("x-quote-token"));
  return sendData(res, serialize(await requestCustomerSalesContact(quote, req.body.channel)));
}

export async function listMine(req, res) {
  const { page, limit, skip } = paginationFrom(req.query);
  const [quotes, total] = await Promise.all([
    Quote.find({ user: req.auth.userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Quote.countDocuments({ user: req.auth.userId }),
  ]);
  return sendData(res, quotes.map((quote) => serialize(quote)), 200, paginationMeta(total, page, limit));
}

export async function getMine(req, res) {
  const quote = await Quote.findOne({ _id: req.params.id, user: req.auth.userId });
  if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  return sendData(res, serialize(quote));
}

export async function acceptMine(req, res) {
  const quote = await Quote.findOne({ _id: req.params.id, user: req.auth.userId });
  if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  return sendData(res, serialize(await acceptCustomerQuote(quote)));
}

export async function contactSalesMine(req, res) {
  const quote = await Quote.findOne({ _id: req.params.id, user: req.auth.userId });
  if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  return sendData(res, serialize(await requestCustomerSalesContact(quote, req.body.channel)));
}

export async function listAdmin(req, res) {
  const { page, limit, skip } = paginationFrom(req.query);
  const filter = req.query.status ? { status: req.query.status } : {};
  const [quotes, total] = await Promise.all([
    Quote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Quote.countDocuments(filter),
  ]);
  return sendData(res, quotes.map((quote) => serialize(quote)), 200, paginationMeta(total, page, limit));
}

export async function getAdmin(req, res) {
  const query = /^[a-f0-9]{24}$/i.test(req.params.id) ? { _id: req.params.id } : { reference: req.params.id };
  const quote = await Quote.findOne(query).select("+internalNotes");
  if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  return sendData(res, serialize(quote));
}

export async function updateQuote(req, res) {
  const input = { ...req.body };
  let current;
  if (input.subtotal != null || input.discount != null || input.total != null || input.paymentMethod != null || input.status === "accepted") {
    current = await Quote.findById(req.params.id);
    if (!current) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  }
  const update = prepareAdminQuoteUpdate(current, input);
  if (update.subtotal != null || update.discount != null || update.total != null) {
    const subtotal = update.subtotal ?? current.subtotal;
    const discount = Math.min(update.discount ?? current.discount, subtotal);
    update.subtotal = subtotal;
    update.discount = discount;
    update.total = update.total ?? Math.max(subtotal - discount, 0);
  }
  const quote = await Quote.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select("+internalNotes");
  if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  return sendData(res, serialize(quote));
}

export async function getCustomPricing(_req, res) {
  return sendData(res, await quoteService.getCustomPricing());
}

export async function listCoupons(req, res) {
  const { page, limit, skip } = paginationFrom(req.query);
  const filter = req.query.active === "true" ? { active: true } : req.query.active === "false" ? { active: false } : {};
  const [coupons, total] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Coupon.countDocuments(filter),
  ]);
  return sendData(res, coupons.map(serializeCoupon), 200, paginationMeta(total, page, limit));
}

export async function createCoupon(req, res) {
  if (await Coupon.exists({ code: req.body.code })) throw new AppError(409, "COUPON_EXISTS", "A coupon with this code already exists");
  return sendData(res, serializeCoupon(await Coupon.create(req.body)), 201);
}

export async function updateCoupon(req, res) {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!coupon) throw new AppError(404, "COUPON_NOT_FOUND", "Coupon was not found");
  return sendData(res, serializeCoupon(coupon));
}
