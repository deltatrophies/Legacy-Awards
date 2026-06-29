import { AppError } from "../../common/errors/AppError.js";
import { paginationFrom, paginationMeta } from "../../common/utils/pagination.js";
import { sendData } from "../../common/utils/response.js";
import { Product } from "./product.model.js";

const serialize = (product) => ({
  id: product.slug,
  databaseId: product._id.toString(),
  sku: product.sku,
  name: product.name,
  category: product.category,
  price: product.price,
  tag: product.tag,
  description: product.description,
  badge: product.badge,
  image: product.images?.[0]?.url || "",
  images: product.images,
  material: product.material,
  size: product.size,
  delivery: product.delivery,
  useCase: product.useCase,
  minOrder: product.minOrder,
  isActive: product.isActive,
});

export async function list(req, res) {
  const { page, limit, skip } = paginationFrom(req.query);
  const filter = { isActive: true };
  if (req.query.category && req.query.category !== "all") filter.category = req.query.category;
  if (req.query.search) filter.$text = { $search: String(req.query.search).slice(0, 100) };
  const sort = req.query.sort === "price-asc" ? { price: 1 } : req.query.sort === "price-desc" ? { price: -1 } : { createdAt: -1 };
  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);
  return sendData(res, products.map(serialize), 200, paginationMeta(total, page, limit));
}

export async function getOne(req, res) {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true }).lean();
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product was not found");
  return sendData(res, serialize(product));
}

export async function create(req, res) {
  return sendData(res, serialize(await Product.create(req.body)), 201);
}

export async function update(req, res) {
  const product = await Product.findOneAndUpdate({ slug: req.params.slug }, req.body, { new: true, runValidators: true });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product was not found");
  return sendData(res, serialize(product));
}

export async function remove(req, res) {
  const product = await Product.findOneAndUpdate({ slug: req.params.slug }, { isActive: false }, { new: true });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product was not found");
  return res.status(204).send();
}
