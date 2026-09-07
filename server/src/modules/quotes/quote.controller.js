import { AppError } from "../../common/errors/AppError.js";
import { paginationFrom, paginationMeta } from "../../common/utils/pagination.js";
import { sendData } from "../../common/utils/response.js";
import { Quote } from "./quote.model.js";
import { Coupon } from "./coupon.model.js";
import * as quoteService from "./quote.service.js";
import { acceptCustomerQuote, prepareAdminQuoteUpdate, requestCustomerSalesContact } from "./quote.workflow.js";
import { User } from "../auth/user.model.js";
import { Order } from "../orders/order.model.js";
import { activityEntry, addDocumentActivity, assertSalesRecordAccess, isAssignmentManager, salesVisibilityFilter } from "../../common/utils/salesAccess.js";

const getRequestEstimate = (quote) => {
  if (quote.requestEstimate != null) return quote.requestEstimate;
  const itemEstimate = quote.items?.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  return itemEstimate || quote.total || 0;
};

const serializePerson = (person) => person ? ({
  id: String(person._id || person),
  firstName: person.firstName || "",
  lastName: person.lastName || "",
  email: person.email || "",
  role: person.role || "",
}) : null;

const serialize = (quote, accessToken, { internal = false } = {}) => ({
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
  paymentStatus: quote.paymentStatus || "unpaid",
  paidAt: quote.paidAt,
  orderReference: quote.orderReference || "",
  customerNotes: quote.customerNotes || "",
  ...(internal ? {
    internalNotes: quote.internalNotes || "",
    assignedTo: serializePerson(quote.assignedTo),
    assignedAt: quote.assignedAt,
    assigneeViewedAt: quote.assigneeViewedAt,
    priority: quote.priority || "normal",
    followUpAt: quote.followUpAt,
    lostReason: quote.lostReason || "",
    activity: (quote.activity || []).slice().reverse().map((entry) => ({
      id: String(entry._id || ""),
      type: entry.type,
      message: entry.message,
      actorName: entry.actorName || "System",
      actorRole: entry.actorRole || "system",
      createdAt: entry.createdAt,
    })),
  } : {}),
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
  return sendData(res, serialize(result.quote, result.accessToken), result.created === false ? 200 : 201);
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
  const quote = await Quote.findOne({ _id: req.params.id, user: req.auth.userId }).select("+activity");
  if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  return sendData(res, serialize(await acceptCustomerQuote(quote)));
}

export async function contactSalesMine(req, res) {
  const quote = await Quote.findOne({ _id: req.params.id, user: req.auth.userId }).select("+activity");
  if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  return sendData(res, serialize(await requestCustomerSalesContact(quote, req.body.channel)));
}

export async function listAdmin(req, res) {
  const { page, limit, skip } = paginationFrom(req.query);
  const clauses = [];
  if (req.query.status) clauses.push({ status: req.query.status });
  if (req.query.priority) clauses.push({ priority: req.query.priority });
  if (req.query.pipeline === "open") clauses.push({ status: { $nin: ["expired", "cancelled"] }, paymentStatus: { $nin: ["paid", "refunded"] } });
  const visibility = salesVisibilityFilter(req.auth, req.query.view);
  if (Object.keys(visibility).length) clauses.push(visibility);
  if (isAssignmentManager(req.auth.role) && req.query.assignedTo) {
    if (req.query.assignedTo !== "unassigned" && !/^[a-f0-9]{24}$/i.test(req.query.assignedTo)) {
      throw new AppError(422, "INVALID_ASSIGNEE", "Assigned salesperson filter is invalid");
    }
    clauses.push(req.query.assignedTo === "unassigned" ? { assignedTo: null } : { assignedTo: req.query.assignedTo });
  }
  const filter = clauses.length ? { $and: clauses } : {};
  const [quotes, total] = await Promise.all([
    Quote.find(filter).populate("assignedTo", "firstName lastName email role").sort({ createdAt: -1 }).skip(skip).limit(limit),
    Quote.countDocuments(filter),
  ]);
  return sendData(res, quotes.map((quote) => serialize(quote, undefined, { internal: true })), 200, paginationMeta(total, page, limit));
}

export async function getAdmin(req, res) {
  const query = /^[a-f0-9]{24}$/i.test(req.params.id) ? { _id: req.params.id } : { reference: req.params.id };
  const quote = await Quote.findOne(query).select("+internalNotes +activity").populate("assignedTo", "firstName lastName email role");
  if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  assertSalesRecordAccess(quote, req.auth);
  return sendData(res, serialize(quote, undefined, { internal: true }));
}

export async function updateQuote(req, res) {
  const input = { ...req.body };
  const current = await Quote.findById(req.params.id).select("+internalNotes +activity");
  if (!current) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  assertSalesRecordAccess(current, req.auth);
  const update = prepareAdminQuoteUpdate(current, input);
  if (update.subtotal != null || update.discount != null || update.total != null) {
    const subtotal = update.subtotal ?? current.subtotal;
    const discount = Math.min(update.discount ?? current.discount, subtotal);
    update.subtotal = subtotal;
    update.discount = discount;
    update.total = update.total ?? Math.max(subtotal - discount, 0);
  }
  Object.assign(current, update);
  const changed = Object.keys(update).filter((key) => key !== "internalNotes").join(", ") || "internal notes";
  addDocumentActivity(current, req.auth, "quote_updated", `Updated ${changed}.`);
  await current.save();
  await current.populate("assignedTo", "firstName lastName email role");
  return sendData(res, serialize(current, undefined, { internal: true }));
}

export async function claimQuote(req, res) {
  const query = /^[a-f0-9]{24}$/i.test(req.params.id) ? { _id: req.params.id } : { reference: req.params.id };
  const existing = await Quote.findOne(query).select("assignedTo status paymentStatus");
  if (!existing) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  if (["expired", "cancelled"].includes(existing.status) || ["paid", "refunded"].includes(existing.paymentStatus)) {
    throw new AppError(409, "LEAD_FINALIZED", "This lead is already finalized and cannot be claimed");
  }
  if (String(existing.assignedTo || "") === String(req.auth.userId)) {
    const ownQuote = await Quote.findById(existing._id).select("+internalNotes +activity").populate("assignedTo", "firstName lastName email role");
    return sendData(res, serialize(ownQuote, undefined, { internal: true }));
  }
  if (existing.assignedTo) throw new AppError(409, "LEAD_ALREADY_ASSIGNED", "Another sales executive has already claimed this lead");

  const entry = activityEntry(req.auth, "lead_claimed", `${req.auth.user.firstName} ${req.auth.user.lastName} claimed this lead.`);
  const quote = await Quote.findOneAndUpdate(
    { _id: existing._id, assignedTo: null },
    {
      $set: { assignedTo: req.auth.userId, assignedBy: req.auth.userId, assignedAt: new Date() },
      $unset: { assigneeViewedAt: 1 },
      $push: { activity: { $each: [entry], $slice: -200 } },
    },
    { new: true, runValidators: true },
  ).select("+internalNotes +activity").populate("assignedTo", "firstName lastName email role");
  if (!quote) throw new AppError(409, "LEAD_ALREADY_ASSIGNED", "Another sales executive has already claimed this lead");
  return sendData(res, serialize(quote, undefined, { internal: true }));
}

export async function assignQuote(req, res) {
  const query = /^[a-f0-9]{24}$/i.test(req.params.id) ? { _id: req.params.id } : { reference: req.params.id };
  const quote = await Quote.findOne(query).select("+internalNotes +activity");
  if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  let assignee = null;
  if (req.body.assigneeId) {
    assignee = await User.findOne({ _id: req.body.assigneeId, role: { $in: ["sales", "sales_manager", "staff"] }, isActive: true });
    if (!assignee) throw new AppError(422, "INVALID_ASSIGNEE", "Choose an active sales team member");
  }
  const previousId = String(quote.assignedTo || "");
  const nextId = String(assignee?._id || "");
  if (previousId === nextId) {
    await quote.populate("assignedTo", "firstName lastName email role");
    return sendData(res, serialize(quote, undefined, { internal: true }));
  }
  quote.assignedTo = assignee?._id || undefined;
  quote.assignedBy = req.auth.userId;
  quote.assignedAt = assignee ? new Date() : undefined;
  quote.assigneeViewedAt = undefined;
  addDocumentActivity(
    quote,
    req.auth,
    assignee ? "lead_assigned" : "lead_unassigned",
    assignee ? `Assigned to ${assignee.firstName} ${assignee.lastName}.` : "Returned to the unassigned lead queue.",
  );
  await quote.save();
  if (quote.convertedOrder) {
    await Order.updateOne(
      { _id: quote.convertedOrder },
      assignee
        ? {
          $set: { assignedTo: assignee._id, assignedBy: req.auth.userId, assignedAt: new Date() },
          $push: { activity: { $each: [{ ...activityEntry(req.auth, "quote_owner_synced", `Order ownership synced from quotation ${quote.reference}.`), metadata: undefined }], $slice: -200 } },
        }
        : {
          $unset: { assignedTo: 1, assignedAt: 1 },
          $set: { assignedBy: req.auth.userId },
          $push: { activity: { $each: [{ ...activityEntry(req.auth, "quote_owner_synced", `Order ownership cleared from quotation ${quote.reference}.`), metadata: undefined }], $slice: -200 } },
        },
    );
  }
  await quote.populate("assignedTo", "firstName lastName email role");
  return sendData(res, serialize(quote, undefined, { internal: true }));
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
