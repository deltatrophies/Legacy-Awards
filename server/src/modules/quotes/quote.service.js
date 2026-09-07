import { createHash, createHmac, randomBytes } from "node:crypto";
import { AppError } from "../../common/errors/AppError.js";
import { createReference } from "../../common/utils/identifiers.js";
import { env } from "../../config/env.js";
import { Product } from "../products/product.model.js";
import { Settings } from "../settings/settings.model.js";
import { Coupon } from "./coupon.model.js";
import { Quote } from "./quote.model.js";
import { User } from "../auth/user.model.js";
import { SalesAssignmentCursor } from "../sales/salesAssignment.model.js";
import { logger } from "../../config/logger.js";

export const defaultCustomPricing = {
  tip: { classic: 300, star: 360, flame: 520 },
  body: { slim: 450, marble: 620, crystal: 780 },
  base: { wood: 300, marble: 380, metal: 420 },
  size: { small: 1, medium: 1.25, large: 1.5, xl: 1.85 },
  finish: { gold: 0, rose: 120, silver: 90, black: 150 },
  branding: { laser: 120, uv: 180, plate: 220, crystal: 350 },
  packaging: { standard: 0, gift: 180, velvet: 320 },
  delivery: { standard: 0, priority: 120, express: 260 },
  bulkDiscounts: [
    { minQuantity: 500, rate: 20 },
    { minQuantity: 200, rate: 15 },
    { minQuantity: 100, rate: 10 },
    { minQuantity: 50, rate: 8 },
  ],
};

const labels = {
  tip: { classic: "Classic Cup", star: "Star Tip", flame: "Crystal Flame" },
  body: { slim: "Slim Gold", marble: "Marble Pillar", crystal: "Crystal Tower" },
  base: { wood: "Wood Base", marble: "Marble Base", metal: "Metal Base" },
};

const hashAccessToken = (accessToken) => createHash("sha256").update(accessToken).digest("hex");
const createAccessToken = (idempotencyKey) => idempotencyKey
  ? createHmac("sha256", env.JWT_ACCESS_SECRET).update(`quote-access:${idempotencyKey}`).digest("hex")
  : randomBytes(24).toString("hex");

function normalizePhone(value = "") {
  return String(value).replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
}

function identifierMatches(customer, identifier) {
  const value = String(identifier || "").trim().toLowerCase();
  if (!value) return false;
  if (customer.email && customer.email.toLowerCase() === value) return true;
  const suppliedPhone = normalizePhone(value);
  return Boolean(suppliedPhone && normalizePhone(customer.phone).endsWith(suppliedPhone.slice(-10)));
}

export function mergeCustomPricing(customPricing = {}) {
  return {
    ...defaultCustomPricing,
    ...customPricing,
    tip: { ...defaultCustomPricing.tip, ...(customPricing.tip || {}) },
    body: { ...defaultCustomPricing.body, ...(customPricing.body || {}) },
    base: { ...defaultCustomPricing.base, ...(customPricing.base || {}) },
    size: { ...defaultCustomPricing.size, ...(customPricing.size || {}) },
    finish: { ...defaultCustomPricing.finish, ...(customPricing.finish || {}) },
    branding: { ...defaultCustomPricing.branding, ...(customPricing.branding || {}) },
    packaging: { ...defaultCustomPricing.packaging, ...(customPricing.packaging || {}) },
    delivery: { ...defaultCustomPricing.delivery, ...(customPricing.delivery || {}) },
    bulkDiscounts: customPricing.bulkDiscounts?.length ? customPricing.bulkDiscounts : defaultCustomPricing.bulkDiscounts,
  };
}

export async function getCustomPricing() {
  const settings = await Settings.findOne({ key: "site" }).lean();
  return mergeCustomPricing(settings?.customPricing);
}

export function calculateCustomItem(design, quantity, customPricing = defaultCustomPricing) {
  const prices = mergeCustomPricing(customPricing);
  const requiredKeys = ["tip", "body", "base", "size", "finish", "branding", "packaging", "delivery"];
  for (const key of requiredKeys) {
    if (prices[key]?.[design[key]] == null) {
      throw new AppError(422, "INVALID_CUSTOM_DESIGN", `Custom ${key} option is unavailable`);
    }
  }
  const baseUnit = prices.tip[design.tip] + prices.body[design.body] + prices.base[design.base]
    + prices.finish[design.finish] + prices.branding[design.branding]
    + prices.packaging[design.packaging] + prices.delivery[design.delivery];
  const regularUnitPrice = Math.round(baseUnit * prices.size[design.size]);
  const discountRate = [...prices.bulkDiscounts]
    .sort((a, b) => b.minQuantity - a.minQuantity)
    .find((tier) => quantity >= tier.minQuantity)?.rate || 0;
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
  const [products, customPricing] = await Promise.all([
    catalogIds.length ? Product.find({ slug: { $in: catalogIds }, isActive: true }).lean() : [],
    items.some((item) => item.kind === "custom") ? getCustomPricing() : Promise.resolve(defaultCustomPricing),
  ]);
  const bySlug = new Map(products.map((product) => [product.slug, product]));

  return items.map((item) => {
    if (item.kind === "custom") return calculateCustomItem(item.design, item.quantity, customPricing);
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

export function nextRoundRobinSalesperson(salespeople, cursor = {}) {
  if (!salespeople.length) return null;
  const lastId = String(cursor.lastAssignee?._id || cursor.lastAssignee || "");
  if (lastId) {
    const exactIndex = salespeople.findIndex((person) => String(person._id) === lastId);
    if (exactIndex >= 0) return salespeople[(exactIndex + 1) % salespeople.length];
    return salespeople.find((person) => String(person._id) > lastId) || salespeople[0];
  }
  return salespeople[Number(cursor.sequence || 0) % salespeople.length];
}

async function reserveNextSalesperson(salespeople) {
  let cursor = await SalesAssignmentCursor.findOneAndUpdate(
    { key: "quotes" },
    { $setOnInsert: { key: "quotes", sequence: 0 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const assignee = nextRoundRobinSalesperson(salespeople, cursor);
    const reserved = await SalesAssignmentCursor.findOneAndUpdate(
      { key: "quotes", sequence: Number(cursor.sequence || 0) },
      { $inc: { sequence: 1 }, $set: { lastAssignee: assignee._id } },
      { new: true },
    );
    if (reserved) return assignee;
    cursor = await SalesAssignmentCursor.findOne({ key: "quotes" });
    if (!cursor) throw new Error("Round-robin cursor disappeared during assignment");
  }
  throw new Error("Round-robin assignment contention was too high");
}

export async function applyAutomaticAssignment(quote) {
  try {
    const settings = await Settings.findOne({ key: "site" }).select("salesAssignmentMode").lean();
    if (settings?.salesAssignmentMode !== "round_robin") return quote;
    const salespeople = await User.find({ role: "sales", isActive: true }).select("_id firstName lastName").sort({ _id: 1 }).lean();
    if (!salespeople.length) return quote;
    const assignee = await reserveNextSalesperson(salespeople);
    quote.assignedTo = assignee._id;
    quote.assignedAt = new Date();
    quote.assigneeViewedAt = undefined;
    quote.activity = [...(quote.activity || []), {
      type: "lead_auto_assigned",
      message: `Automatically assigned to ${assignee.firstName} ${assignee.lastName}.`,
      actorName: "Round-robin assignment",
      actorRole: "system",
      createdAt: new Date(),
    }].slice(-200);
    await quote.save();
  } catch (error) {
    logger.warn({ quoteReference: quote.reference, error: error.message }, "Automatic sales assignment failed; quote remains in the open queue");
  }
  return quote;
}

export async function validateCoupon(code, subtotal) {
  const coupon = await calculateDiscount(code, subtotal);
  return {
    code: coupon.couponCode,
    discount: coupon.discount,
    total: Math.max(subtotal - coupon.discount, 0),
  };
}

export async function createQuote(input, userId) {
  const accessToken = createAccessToken(input.idempotencyKey);
  if (input.idempotencyKey) {
    const existing = await Quote.findOne({ idempotencyKey: input.idempotencyKey });
    if (existing) return { quote: existing, accessToken, created: false };
  }
  const items = await resolveItems(input.items);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const coupon = await calculateDiscount(input.couponCode, subtotal);
  const quoteInput = {
    idempotencyKey: input.idempotencyKey,
    accessTokenHash: hashAccessToken(accessToken),
    user: userId,
    customer: input.customer,
    items,
    requestEstimate: subtotal - coupon.discount,
    subtotal,
    ...coupon,
    total: subtotal - coupon.discount,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    activity: [{
      type: "quote_submitted",
      message: "Customer submitted a quote request.",
      actorName: input.customer.name,
      actorRole: "customer",
      createdAt: new Date(),
    }],
  };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const quote = await Quote.create({ ...quoteInput, reference: createReference("LAQ") });
      await applyAutomaticAssignment(quote);
      return { quote, accessToken, created: true };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      if (input.idempotencyKey) {
        const existing = await Quote.findOne({ idempotencyKey: input.idempotencyKey });
        if (existing) return { quote: existing, accessToken, created: false };
      }
      if (!error?.keyPattern?.reference || attempt === 3) throw error;
    }
  }
  throw new AppError(500, "QUOTE_CREATION_FAILED", "The quote request could not be created");
}

export async function getPublicQuote(reference, accessToken) {
  if (!accessToken) throw new AppError(401, "QUOTE_TOKEN_REQUIRED", "A quote access token is required");
  const accessTokenHash = hashAccessToken(accessToken);
  const quote = await Quote.findOne({ reference }).select("+accessTokenHash +activity");
  if (!quote || quote.accessTokenHash !== accessTokenHash) {
    throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found");
  }
  return quote;
}

export async function trackQuote(reference, identifier) {
  const quote = await Quote.findOne({ reference }).select("+accessTokenHash");
  if (!quote || !identifierMatches(quote.customer, identifier)) {
    throw new AppError(404, "QUOTE_NOT_FOUND", "Quote was not found for those details");
  }
  const accessToken = randomBytes(24).toString("hex");
  quote.accessTokenHash = hashAccessToken(accessToken);
  await quote.save();
  return { quote, accessToken };
}
