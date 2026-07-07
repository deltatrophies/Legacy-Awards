import { AppError } from "../../common/errors/AppError.js";
import { sendData } from "../../common/utils/response.js";
import { Category } from "./category.model.js";

const defaultCategories = [
  { slug: "trophies", name: "Trophies", sortOrder: 10 },
  { slug: "plaques", name: "Plaques", sortOrder: 20 },
  { slug: "medals", name: "Medals", sortOrder: 30 },
  { slug: "crystal", name: "Crystal", sortOrder: 40 },
];

const serialize = (category) => ({
  id: category.slug,
  databaseId: category._id?.toString(),
  slug: category.slug,
  name: category.name,
  description: category.description || "",
  imageUrl: category.imageUrl || "",
  sortOrder: category.sortOrder || 0,
  isActive: category.isActive !== false,
  createdAt: category.createdAt,
});

async function ensureDefaultCategories() {
  if (await Category.exists({})) return;
  await Category.insertMany(defaultCategories);
}

export async function list(req, res) {
  await ensureDefaultCategories();
  const filter = req.auth?.role === "admin" && req.query.includeInactive === "true" ? {} : { isActive: true };
  const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
  return sendData(res, categories.map(serialize));
}

export async function create(req, res) {
  if (await Category.exists({ slug: req.body.slug })) {
    throw new AppError(409, "CATEGORY_EXISTS", "A category with this slug already exists");
  }
  const category = await Category.create(req.body);
  return sendData(res, serialize(category), 201);
}

export async function update(req, res) {
  const category = await Category.findOneAndUpdate({ slug: req.params.slug }, req.body, { new: true, runValidators: true });
  if (!category) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category was not found");
  return sendData(res, serialize(category));
}

export async function remove(req, res) {
  const category = await Category.findOneAndUpdate({ slug: req.params.slug }, { isActive: false }, { new: true });
  if (!category) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category was not found");
  return res.status(204).send();
}
