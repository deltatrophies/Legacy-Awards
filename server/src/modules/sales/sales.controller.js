import { sendData } from "../../common/utils/response.js";
import { salesVisibilityFilter } from "../../common/utils/salesAccess.js";
import { Order } from "../orders/order.model.js";
import { Quote } from "../quotes/quote.model.js";
import { User } from "../auth/user.model.js";

export async function summary(req, res) {
  const visibility = salesVisibilityFilter(req.auth, "mine");
  const ownFilter = Object.keys(visibility).length ? visibility : {};
  const now = new Date();
  const [assignedLeads, unassignedLeads, needsAttention, followUpsDue, openOrders, paidOrders] = await Promise.all([
    Quote.countDocuments({ ...ownFilter, status: { $nin: ["expired", "cancelled"] }, paymentStatus: { $nin: ["paid", "refunded"] } }),
    Quote.countDocuments({ assignedTo: null, status: { $nin: ["expired", "cancelled"] }, paymentStatus: { $nin: ["paid", "refunded"] } }),
    Quote.countDocuments({ ...ownFilter, customerDecision: { $in: ["accepted", "sales_requested"] }, paymentStatus: { $nin: ["paid", "refunded"] } }),
    Quote.countDocuments({ ...ownFilter, followUpAt: { $lte: now }, status: { $nin: ["expired", "cancelled"] }, paymentStatus: { $nin: ["paid", "refunded"] } }),
    Order.countDocuments({ ...ownFilter, fulfillmentStatus: { $nin: ["delivered", "cancelled"] } }),
    Order.countDocuments(ownFilter),
  ]);
  return sendData(res, { assignedLeads, unassignedLeads, needsAttention, followUpsDue, openOrders, paidOrders });
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
