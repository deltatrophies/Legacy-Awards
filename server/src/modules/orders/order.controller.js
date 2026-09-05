import { AppError } from "../../common/errors/AppError.js";
import { paginationFrom, paginationMeta } from "../../common/utils/pagination.js";
import { sendData } from "../../common/utils/response.js";
import { getPublicQuote } from "../quotes/quote.service.js";
import { Order } from "./order.model.js";
import { User } from "../auth/user.model.js";
import { Quote } from "../quotes/quote.model.js";
import { activityEntry, addDocumentActivity, assertSalesRecordAccess, isAssignmentManager, salesVisibilityFilter } from "../../common/utils/salesAccess.js";

const serializeCustomerOrder = (order) => {
  const value = typeof order?.toObject === "function" ? order.toObject() : { ...order };
  return {
    id: String(value._id || ""),
    reference: value.reference,
    customer: value.customer,
    items: value.items,
    subtotal: value.subtotal,
    discount: value.discount,
    total: value.total,
    currency: value.currency,
    paymentStatus: value.paymentStatus,
    paymentProvider: value.paymentProvider,
    gatewayPaymentId: value.gatewayPaymentId,
    paidAt: value.paidAt,
    fulfillmentStatus: value.fulfillmentStatus,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

export async function getPublicByQuote(req, res) {
  const quote = await getPublicQuote(req.params.reference, req.get("x-quote-token"));
  const order = await Order.findOne({ quote: quote._id }).lean();
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "A paid order has not been created for this quote yet");
  return sendData(res, serializeCustomerOrder(order));
}

export async function list(req, res) {
  const { page, limit, skip } = paginationFrom(req.query);
  const clauses = [];
  if (req.query.status) clauses.push({ fulfillmentStatus: req.query.status });
  const visibility = salesVisibilityFilter(req.auth, req.query.view);
  if (Object.keys(visibility).length) clauses.push(visibility);
  if (isAssignmentManager(req.auth.role) && req.query.assignedTo) {
    if (req.query.assignedTo !== "unassigned" && !/^[a-f0-9]{24}$/i.test(req.query.assignedTo)) {
      throw new AppError(422, "INVALID_ASSIGNEE", "Assigned salesperson filter is invalid");
    }
    clauses.push(req.query.assignedTo === "unassigned" ? { assignedTo: null } : { assignedTo: req.query.assignedTo });
  }
  const filter = clauses.length ? { $and: clauses } : {};
  const [orders, total] = await Promise.all([
    Order.find(filter).populate("assignedTo", "firstName lastName email role").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  return sendData(res, orders, 200, paginationMeta(total, page, limit));
}

export async function listMine(req, res) {
  const { page, limit, skip } = paginationFrom(req.query);
  const [orders, total] = await Promise.all([
    Order.find({ user: req.auth.userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments({ user: req.auth.userId }),
  ]);
  return sendData(res, orders.map(serializeCustomerOrder), 200, paginationMeta(total, page, limit));
}

export async function getMine(req, res) {
  const query = /^[a-f0-9]{24}$/i.test(req.params.id)
    ? { _id: req.params.id, user: req.auth.userId }
    : { reference: req.params.id, user: req.auth.userId };
  const order = await Order.findOne(query).lean();
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order was not found");
  return sendData(res, serializeCustomerOrder(order));
}

export async function getOne(req, res) {
  const query = /^[a-f0-9]{24}$/i.test(req.params.id) ? { _id: req.params.id } : { reference: req.params.id };
  const order = await Order.findOne(query).select("+activity").populate("assignedTo", "firstName lastName email role").lean();
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order was not found");
  assertSalesRecordAccess(order, req.auth, { allowUnassignedRead: true });
  return sendData(res, order);
}

export async function claim(req, res) {
  const query = /^[a-f0-9]{24}$/i.test(req.params.id) ? { _id: req.params.id } : { reference: req.params.id };
  const existing = await Order.findOne(query).select("assignedTo fulfillmentStatus");
  if (!existing) throw new AppError(404, "ORDER_NOT_FOUND", "Order was not found");
  if (["delivered", "cancelled"].includes(existing.fulfillmentStatus)) {
    throw new AppError(409, "ORDER_FINALIZED", "This order is already finalized and cannot be claimed");
  }
  if (String(existing.assignedTo || "") === String(req.auth.userId)) {
    const ownOrder = await Order.findById(existing._id).select("+activity").populate("assignedTo", "firstName lastName email role");
    return sendData(res, ownOrder);
  }
  if (existing.assignedTo) throw new AppError(409, "ORDER_ALREADY_ASSIGNED", "Another sales executive has already claimed this order");
  const entry = activityEntry(req.auth, "order_claimed", `${req.auth.user.firstName} ${req.auth.user.lastName} claimed this order.`);
  const order = await Order.findOneAndUpdate(
    { _id: existing._id, assignedTo: null },
    {
      $set: { assignedTo: req.auth.userId, assignedBy: req.auth.userId, assignedAt: new Date() },
      $push: { activity: { $each: [entry], $slice: -200 } },
    },
    { new: true, runValidators: true },
  ).select("+activity").populate("assignedTo", "firstName lastName email role");
  if (!order) throw new AppError(409, "ORDER_ALREADY_ASSIGNED", "Another sales executive has already claimed this order");
  await Quote.updateOne(
    { _id: order.quote },
    {
      $set: { assignedTo: req.auth.userId, assignedBy: req.auth.userId, assignedAt: new Date() },
      $push: { activity: { $each: [activityEntry(req.auth, "order_owner_synced", `Paid order ${order.reference} was claimed by the assigned salesperson.`)], $slice: -200 } },
    },
  );
  return sendData(res, order);
}

export async function update(req, res) {
  const order = await Order.findById(req.params.id).select("+activity");
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order was not found");
  assertSalesRecordAccess(order, req.auth);
  const previous = order.fulfillmentStatus;
  order.fulfillmentStatus = req.body.fulfillmentStatus;
  if (previous !== order.fulfillmentStatus) {
    addDocumentActivity(order, req.auth, "fulfillment_updated", `Fulfillment changed from ${previous} to ${order.fulfillmentStatus}.`);
  }
  await order.save();
  if (previous !== order.fulfillmentStatus) {
    await Quote.updateOne(
      { _id: order.quote },
      { $push: { activity: { $each: [activityEntry(req.auth, "fulfillment_updated", `Order ${order.reference} moved from ${previous} to ${order.fulfillmentStatus}.`)], $slice: -200 } } },
    );
  }
  await order.populate("assignedTo", "firstName lastName email role");
  return sendData(res, order);
}

export async function assign(req, res) {
  const query = /^[a-f0-9]{24}$/i.test(req.params.id) ? { _id: req.params.id } : { reference: req.params.id };
  const order = await Order.findOne(query).select("+activity");
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order was not found");
  let assignee = null;
  if (req.body.assigneeId) {
    assignee = await User.findOne({ _id: req.body.assigneeId, role: { $in: ["sales", "sales_manager", "staff"] }, isActive: true });
    if (!assignee) throw new AppError(422, "INVALID_ASSIGNEE", "Choose an active sales team member");
  }
  order.assignedTo = assignee?._id || undefined;
  order.assignedBy = req.auth.userId;
  order.assignedAt = assignee ? new Date() : undefined;
  addDocumentActivity(
    order,
    req.auth,
    assignee ? "order_assigned" : "order_unassigned",
    assignee ? `Assigned to ${assignee.firstName} ${assignee.lastName}.` : "Returned to the unassigned order queue.",
  );
  await order.save();
  await Quote.updateOne(
    { _id: order.quote },
    assignee ? {
      $set: { assignedTo: assignee._id, assignedBy: req.auth.userId, assignedAt: new Date() },
      $push: { activity: { $each: [activityEntry(req.auth, "order_owner_synced", `Paid order ${order.reference} was assigned to ${assignee.firstName} ${assignee.lastName}.`)], $slice: -200 } },
    } : {
      $unset: { assignedTo: 1, assignedAt: 1 },
      $set: { assignedBy: req.auth.userId },
      $push: { activity: { $each: [activityEntry(req.auth, "order_owner_synced", `Paid order ${order.reference} was returned to the unassigned queue.`)], $slice: -200 } },
    },
  );
  await order.populate("assignedTo", "firstName lastName email role");
  return sendData(res, order);
}
