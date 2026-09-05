import bcrypt from "bcryptjs";
import { AppError } from "../../common/errors/AppError.js";
import { sendData } from "../../common/utils/response.js";
import { Category } from "../categories/category.model.js";
import { Inquiry } from "../inquiries/inquiry.model.js";
import { Order } from "../orders/order.model.js";
import { Product } from "../products/product.model.js";
import { Quote } from "../quotes/quote.model.js";
import { User } from "../auth/user.model.js";

const teamRoles = ["sales", "sales_manager", "staff"];

const teamMemberData = (user, workloads = {}) => ({
  id: user._id.toString(),
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone || "",
  jobTitle: user.jobTitle || (user.role === "sales_manager" ? "Sales Manager" : "Sales Executive"),
  role: user.role === "staff" ? "sales_manager" : user.role,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  assignedQuotes: workloads.quotes || 0,
  openOrders: workloads.orders || 0,
});

export async function summary(_req, res) {
  const [
    totalProducts,
    activeProducts,
    totalCategories,
    newInquiries,
    totalInquiries,
    pendingOrders,
    totalOrders,
    recentInquiries,
    recentOrders,
    activeSales,
    unassignedQuotes,
    overdueFollowUps,
  ] = await Promise.all([
    Product.countDocuments(),
    Product.countDocuments({ isActive: true }),
    Category.countDocuments({ isActive: true }),
    Inquiry.countDocuments({ status: "new" }),
    Inquiry.countDocuments(),
    Order.countDocuments({ fulfillmentStatus: { $in: ["pending", "artwork", "production"] } }),
    Order.countDocuments(),
    Inquiry.find().sort({ createdAt: -1 }).limit(5).lean(),
    Order.find().sort({ createdAt: -1 }).limit(5).lean(),
    User.countDocuments({ role: { $in: teamRoles }, isActive: true }),
    Quote.countDocuments({ assignedTo: null, status: { $nin: ["expired", "cancelled"] }, paymentStatus: { $nin: ["paid", "refunded"] } }),
    Quote.countDocuments({ followUpAt: { $lte: new Date() }, status: { $nin: ["expired", "cancelled"] }, paymentStatus: { $nin: ["paid", "refunded"] } }),
  ]);

  return sendData(res, {
    counts: {
      totalProducts,
      activeProducts,
      totalCategories,
      newInquiries,
      totalInquiries,
      pendingOrders,
      totalOrders,
      activeSales,
      unassignedQuotes,
      overdueFollowUps,
    },
    recentInquiries,
    recentOrders,
  });
}

export async function listTeam(_req, res) {
  const [users, quoteWorkloads, orderWorkloads] = await Promise.all([
    User.find({ role: { $in: teamRoles } }).sort({ isActive: -1, firstName: 1, lastName: 1 }).lean(),
    Quote.aggregate([
      { $match: { assignedTo: { $ne: null }, status: { $nin: ["expired", "cancelled"] }, paymentStatus: { $nin: ["paid", "refunded"] } } },
      { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { assignedTo: { $ne: null }, fulfillmentStatus: { $nin: ["delivered", "cancelled"] } } },
      { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
    ]),
  ]);
  const quoteCounts = new Map(quoteWorkloads.map((item) => [String(item._id), item.count]));
  const orderCounts = new Map(orderWorkloads.map((item) => [String(item._id), item.count]));
  return sendData(res, users.map((user) => teamMemberData(user, {
    quotes: quoteCounts.get(String(user._id)) || 0,
    orders: orderCounts.get(String(user._id)) || 0,
  })));
}

export async function createTeamMember(req, res) {
  if (await User.exists({ email: req.body.email })) {
    throw new AppError(409, "EMAIL_IN_USE", "An account with this email already exists");
  }
  const user = await User.create({
    ...req.body,
    passwordHash: await bcrypt.hash(req.body.password, 12),
    password: undefined,
  });
  return sendData(res, teamMemberData(user), 201);
}

export async function updateTeamMember(req, res) {
  const user = await User.findOne({ _id: req.params.id, role: { $in: teamRoles } }).select("+sessions +sessionVersion");
  if (!user) throw new AppError(404, "TEAM_MEMBER_NOT_FOUND", "Sales team member was not found");
  if (req.body.email && req.body.email !== user.email && await User.exists({ email: req.body.email, _id: { $ne: user._id } })) {
    throw new AppError(409, "EMAIL_IN_USE", "An account with this email already exists");
  }
  if (req.body.isActive === false && user.isActive) {
    const [openLeads, openOrders] = await Promise.all([
      Quote.countDocuments({
        assignedTo: user._id,
        status: { $nin: ["expired", "cancelled"] },
        paymentStatus: { $nin: ["paid", "refunded"] },
      }),
      Order.countDocuments({
        assignedTo: user._id,
        fulfillmentStatus: { $nin: ["delivered", "cancelled"] },
      }),
    ]);
    if (openLeads || openOrders) {
      throw new AppError(
        409,
        "ACTIVE_ASSIGNMENTS",
        `Reassign this account's active work before disabling it (${openLeads} lead${openLeads === 1 ? "" : "s"}, ${openOrders} order${openOrders === 1 ? "" : "s"})`,
      );
    }
  }

  const sensitiveChange = req.body.password || req.body.role || req.body.isActive === false;
  for (const field of ["firstName", "lastName", "email", "role", "phone", "jobTitle", "isActive"]) {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  }
  if (req.body.password) user.passwordHash = await bcrypt.hash(req.body.password, 12);
  if (sensitiveChange) {
    user.sessions = [];
    user.sessionVersion = Number(user.sessionVersion || 0) + 1;
  }
  await user.save();
  return sendData(res, teamMemberData(user));
}
