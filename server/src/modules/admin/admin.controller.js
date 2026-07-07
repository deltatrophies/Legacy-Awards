import { sendData } from "../../common/utils/response.js";
import { Category } from "../categories/category.model.js";
import { Inquiry } from "../inquiries/inquiry.model.js";
import { Order } from "../orders/order.model.js";
import { Product } from "../products/product.model.js";

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
    },
    recentInquiries,
    recentOrders,
  });
}
