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

const serializeAdminList = (product) => ({
  id: product.slug,
  sku: product.sku,
  name: product.name,
  category: product.category,
  price: product.price,
  image: product.images?.[0]?.url || "",
  material: product.material,
  minOrder: product.minOrder,
  isActive: product.isActive,
});

export async function list(req, res) {
  const { page, limit, skip } = paginationFrom(req.query);
  const canSeeInactive = req.auth?.role === "admin" && req.query.includeInactive === "true";
  const isAdminList = req.auth?.role === "admin" && req.query.adminList === "true";
  const baseFilter = canSeeInactive ? {} : { isActive: true };
  if (req.query.search) baseFilter.$text = { $search: String(req.query.search).slice(0, 100) };
  const filter = { ...baseFilter };
  if (req.query.category && req.query.category !== "all") filter.category = req.query.category;
  const sort = isAdminList
    ? { category: 1, name: 1 }
    : req.query.sort === "price-asc" ? { price: 1 } : req.query.sort === "price-desc" ? { price: -1 } : { createdAt: -1 };
  const productQuery = Product.find(filter).sort(sort).skip(skip).limit(limit);
  if (isAdminList) productQuery.select("slug sku name category price images.url material minOrder isActive");

  const requests = [
    productQuery.lean(),
    Product.countDocuments(filter),
  ];
  if (isAdminList) {
    requests.push(
      Product.countDocuments({ ...filter, isActive: true }),
      Product.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: "$category",
            total: { $sum: 1 },
            active: { $sum: { $cond: ["$isActive", 1, 0] } },
          },
        },
      ]),
    );
  }

  const [products, total, activeTotal, categoryRows] = await Promise.all(requests);
  const meta = paginationMeta(total, page, limit);
  if (isAdminList) {
    meta.activeTotal = activeTotal;
    meta.categoryCounts = Object.fromEntries(categoryRows.map((row) => [row._id || "uncategorized", {
      total: row.total,
      active: row.active,
    }]));
  }
  return sendData(res, products.map(isAdminList ? serializeAdminList : serialize), 200, meta);
}

export async function getOne(req, res) {
  const canSeeInactive = req.auth?.role === "admin";
  const product = await Product.findOne({ slug: req.params.slug, ...(canSeeInactive ? {} : { isActive: true }) }).lean();
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

export async function restore(req, res) {
  const product = await Product.findOneAndUpdate({ slug: req.params.slug }, { isActive: true }, { new: true, runValidators: true });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product was not found");
  return sendData(res, serialize(product));
}
