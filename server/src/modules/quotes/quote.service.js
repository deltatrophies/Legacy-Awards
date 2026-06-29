import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../../common/errors/AppError.js";
import { createReference } from "../../common/utils/identifiers.js";
import { Product } from "../products/product.model.js";
import { Coupon } from "./coupon.model.js";
import { Quote } from "./quote.model.js";

const prices = {
  tip: { classic: 300, star: 360, flame: 520 },
  body: { slim: 450, marble: 620, crystal: 780 },
  base: { wood: 300, marble: 380, metal: 420 },
  size: { small: 1, medium: 1.25, large: 1.5, xl: 1.85 },
  finish: { gold: 0, rose: 120, silver: 90, black: 150 },
  branding: { laser: 120, uv: 180, plate: 220, crystal: 350 },
  packaging: { standard: 0, gift: 180, velvet: 320 },
  delivery: { standard: 0, priority: 120, express: 260 },
};

const labels = {
  tip: { classic: "Classic Cup", star: "Star Tip", flame: "Crystal Flame" },
  body: { slim: "Slim Gold", marble: "Marble Pillar", crystal: "Crystal Tower" },
  base: { wood: "Wood Base", marble: "Marble Base", metal: "Metal Base" },
};

export function calculateCustomItem(design, quantity) {
  const baseUnit = prices.tip[design.tip] + prices.body[design.body] + prices.base[design.base]
    + prices.finish[design.finish] + prices.branding[design.branding]
    + prices.packaging[design.packaging] + prices.delivery[design.delivery];
  const regularUnitPrice = Math.round(baseUnit * prices.size[design.size]);
  const discountRate = quantity >= 500 ? 20 : quantity >= 200 ? 15 : quantity >= 100 ? 10 : quantity >= 50 ? 8 : 0;
  const lineTotal = Math.round(regularUnitPrice * quantity * (1 - discountRate / 100));
  return {
    kind: "custom",
    name: "Custom Fusion Trophy",
    image: design.logo || "",
    quantity,
    unitPrice: Math.round(lineTotal / quantity),
    lineTotal,
    design: {
      ...design,
      summary: `${labels.tip[design.tip]}, ${labels.body[design.body]}, ${labels.base[design.base]}`,
      bulkDiscountRate: discountRate,
    },
  };
}

async function resolveItems(items) {
  const catalogIds = items.filter((item) => item.kind === "catalog").map((item) => item.productId);
  const products = catalogIds.length ? await Product.find({ slug: { $in: catalogIds }, isActive: true }).lean() : [];
  const bySlug = new Map(products.map((product) => [product.slug, product]));

  return items.map((item) => {
    if (item.kind === "custom") return calculateCustomItem(item.design, item.quantity);
    const product = bySlug.get(item.productId);
    if (!product) throw new AppError(422, "PRODUCT_UNAVAILABLE", `Product ${item.productId} is unavailable`);
    if (item.quantity < product.minOrder) {
      throw new AppError(422, "MINIMUM_ORDER", `${product.name} requires at least ${product.minOrder} units`);
    }
    return {
      kind: "catalog",
      product: product._id,
      sku: product.sku,
      name: product.name,
      image: product.images?.[0]?.url || "",
      quantity: item.quantity,
      unitPrice: product.price,
      lineTotal: product.price * item.quantity,
    };
  });
}

async function calculateDiscount(code, subtotal) {
  if (!code) return { discount: 0, couponCode: undefined };
  const now = new Date();
  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    active: true,
    minimumSubtotal: { $lte: subtotal },
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
    ],
  }).lean();
  if (!coupon) throw new AppError(422, "INVALID_COUPON", "This coupon is invalid or unavailable");
  let discount = coupon.type === "percentage" ? Math.round(subtotal * coupon.value / 100) : coupon.value;
  if (coupon.maximumDiscount != null) discount = Math.min(discount, coupon.maximumDiscount);
  return { discount: Math.min(discount, subtotal), couponCode: coupon.code };
}

export async function createQuote(input, userId) {
  const items = await resolveItems(input.items);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const coupon = await calculateDiscount(input.couponCode, subtotal);
  const accessToken = randomBytes(24).toString("hex");
  const quote = await Quote.create({
    reference: createReference("LAQ"),
    accessTokenHash: createHash("sha256").update(accessToken).digest("hex"),
    user: userId,
    customer: input.customer,
    items,
    subtotal,
    ...coupon,
    total: subtotal - coupon.discount,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  return { quote, accessToken };
}

export async function getPublicQuote(reference, accessToken) {
  if (!accessToken) throw new AppError(401, "QUOTE_TOKEN_REQUIRED", "A quote access token is required");
  const accessTokenHash = createHash("sha256").update(accessToken).digest("hex");
  const quote = await Quote.findOne({ reference }).select("+accessTokenHash");
  if (!quote || quote.accessTokenHash !== accessTokenHash) {
    throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  }
  return quote;
}
