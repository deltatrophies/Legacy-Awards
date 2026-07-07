import { AppError } from "../../common/errors/AppError.js";
import { paginationFrom, paginationMeta } from "../../common/utils/pagination.js";
import { sendData } from "../../common/utils/response.js";
import { Order } from "./order.model.js";

export async function list(req, res) {
  const { page, limit, skip } = paginationFrom(req.query);
  const filter = req.query.status ? { fulfillmentStatus: req.query.status } : {};
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
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
  return sendData(res, orders, 200, paginationMeta(total, page, limit));
}

export async function update(req, res) {
  const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order was not found");
  return sendData(res, order);
}
