import { sendData } from "../../common/utils/response.js";
import { salesVisibilityFilter } from "../../common/utils/salesAccess.js";
import { Order } from "../orders/order.model.js";
import { Quote } from "../quotes/quote.model.js";
import { Inquiry } from "../inquiries/inquiry.model.js";
import { User } from "../auth/user.model.js";
import { AppError } from "../../common/errors/AppError.js";

export async function summary(req, res) {
  const visibility = salesVisibilityFilter(req.auth, "mine");
  const ownFilter = Object.keys(visibility).length ? visibility : {};
  const now = new Date();
  const [assignedLeads, assignedInquiries, newQuotes, newInquiries, unassignedLeads, needsAttention, followUpsDue, openOrders, paidOrders] = await Promise.all([
    Quote.countDocuments({ ...ownFilter, status: { $nin: ["expired", "cancelled"] }, paymentStatus: { $nin: ["paid", "refunded"] } }),
    Inquiry.countDocuments({ assignedTo: req.auth.userId, status: { $nin: ["closed", "spam"] } }),
    Quote.countDocuments({ assignedTo: req.auth.userId, assigneeViewedAt: null, status: { $nin: ["expired", "cancelled"] }, paymentStatus: { $nin: ["paid", "refunded"] } }),
    Inquiry.countDocuments({ assignedTo: req.auth.userId, assigneeViewedAt: null, status: { $nin: ["closed", "spam"] } }),
    Quote.countDocuments({ assignedTo: null, status: { $nin: ["expired", "cancelled"] }, paymentStatus: { $nin: ["paid", "refunded"] } }),
    Quote.countDocuments({ ...ownFilter, customerDecision: { $in: ["accepted", "sales_requested"] }, paymentStatus: { $nin: ["paid", "refunded"] } }),
    Quote.countDocuments({ ...ownFilter, followUpAt: { $lte: now }, status: { $nin: ["expired", "cancelled"] }, paymentStatus: { $nin: ["paid", "refunded"] } }),
    Order.countDocuments({ ...ownFilter, fulfillmentStatus: { $nin: ["delivered", "cancelled"] } }),
    Order.countDocuments(ownFilter),
  ]);
  return sendData(res, { assignedLeads, assignedInquiries, newAssignedLeads: newQuotes + newInquiries, unassignedLeads, needsAttention, followUpsDue, openOrders, paidOrders });
}

export async function revision(req, res) {
  const visibility = salesVisibilityFilter(req.auth, "all");
  const inquiryVisibility = req.auth.role === "admin" ? {} : { assignedTo: req.auth.userId };
  const [quoteCount, latestQuote, orderCount, latestOrder, inquiryCount, latestInquiry] = await Promise.all([
    Quote.countDocuments(visibility),
    Quote.findOne(visibility).sort({ updatedAt: -1 }).select("updatedAt").lean(),
    Order.countDocuments(visibility),
    Order.findOne(visibility).sort({ updatedAt: -1 }).select("updatedAt").lean(),
    Inquiry.countDocuments(inquiryVisibility),
    Inquiry.findOne(inquiryVisibility).sort({ updatedAt: -1 }).select("updatedAt").lean(),
  ]);
  const quoteRevision = latestQuote?.updatedAt ? new Date(latestQuote.updatedAt).getTime() : 0;
  const orderRevision = latestOrder?.updatedAt ? new Date(latestOrder.updatedAt).getTime() : 0;
  const inquiryRevision = latestInquiry?.updatedAt ? new Date(latestInquiry.updatedAt).getTime() : 0;
  return sendData(res, { revision: `${quoteCount}:${quoteRevision}:${orderCount}:${orderRevision}:${inquiryCount}:${inquiryRevision}` });
}

export async function markLeadViewed(req, res) {
  const models = { quote: Quote, inquiry: Inquiry };
  const Model = models[req.params.kind];
  if (!Model) throw new AppError(422, "INVALID_LEAD_KIND", "Lead type is invalid");
  const identifier = req.params.id;
  const identity = /^[a-f0-9]{24}$/i.test(identifier) ? { _id: identifier } : { reference: identifier };
  const viewedAt = new Date();
  const record = await Model.findOneAndUpdate(
    { ...identity, assignedTo: req.auth.userId },
    { $set: { assigneeViewedAt: viewedAt } },
    { new: true },
  ).select("assigneeViewedAt");
  if (!record) throw new AppError(404, "LEAD_NOT_FOUND", "Assigned lead was not found");
  return sendData(res, { viewedAt: record.assigneeViewedAt });
}

export async function team(_req, res) {
  const users = await User.find({ role: { $in: ["sales", "sales_manager", "staff"] }, isActive: true })
    .select("firstName lastName email role jobTitle")
    .sort({ firstName: 1, lastName: 1 })
    .lean();
  return sendData(res, users.map((user) => ({
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role === "staff" ? "sales_manager" : user.role,
    jobTitle: user.jobTitle || "",
  })));
}
