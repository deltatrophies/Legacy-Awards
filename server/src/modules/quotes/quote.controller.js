import { AppError } from "../../common/errors/AppError.js";
import { paginationFrom, paginationMeta } from "../../common/utils/pagination.js";
import { sendData } from "../../common/utils/response.js";
import { Quote } from "./quote.model.js";
import * as quoteService from "./quote.service.js";

const serialize = (quote, accessToken) => ({
  id: quote._id.toString(),
  reference: quote.reference,
  ...(accessToken ? { accessToken } : {}),
  customer: quote.customer,
  items: quote.items,
  subtotal: quote.subtotal,
  discount: quote.discount,
  total: quote.total,
  currency: quote.currency,
  status: quote.status,
  expiresAt: quote.expiresAt,
  createdAt: quote.createdAt,
});

export async function create(req, res) {
  const result = await quoteService.createQuote(req.body, req.auth?.userId);
  return sendData(res, serialize(result.quote, result.accessToken), 201);
}

export async function getPublic(req, res) {
  const quote = await quoteService.getPublicQuote(req.params.reference, req.get("x-quote-token"));
  return sendData(res, serialize(quote));
}

export async function listMine(req, res) {
  const { page, limit, skip } = paginationFrom(req.query);
  const [quotes, total] = await Promise.all([
    Quote.find({ user: req.auth.userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Quote.countDocuments({ user: req.auth.userId }),
  ]);
  return sendData(res, quotes.map((quote) => serialize(quote)), 200, paginationMeta(total, page, limit));
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

export async function updateStatus(req, res) {
  const quote = await Quote.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  return sendData(res, serialize(quote));
}
