import { z } from "zod";

const designSchema = z.object({
  tip: z.enum(["classic", "star", "flame"]),
  body: z.enum(["slim", "marble", "crystal"]),
  base: z.enum(["wood", "marble", "metal"]),
  size: z.enum(["small", "medium", "large", "xl"]),
  finish: z.enum(["gold", "rose", "silver", "black"]),
  branding: z.enum(["laser", "uv", "plate", "crystal"]),
  packaging: z.enum(["standard", "gift", "velvet"]),
  delivery: z.enum(["standard", "priority", "express"]),
  text: z.string().max(500).default(""),
  font: z.enum(["classic", "modern", "bold", "script"]).default("classic"),
  align: z.enum(["left", "center", "right"]).default("center"),
  textSize: z.coerce.number().min(11).max(26).default(16),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#5c1a1a"),
  textPosition: z.enum(["top", "center", "base"]).default("base"),
  logo: z.string().max(2000).optional().default(""),
  logoSize: z.coerce.number().min(36).max(130).default(70),
  logoX: z.coerce.number().min(0).max(100).default(50),
  logoY: z.coerce.number().min(0).max(100).default(38),
  eventDate: z.string().max(10).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
}).passthrough();

const itemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("catalog"), productId: z.string().min(1), quantity: z.coerce.number().int().positive().max(10000) }),
  z.object({ kind: z.literal("custom"), quantity: z.coerce.number().int().positive().max(10000), design: designSchema }),
]);

export const createQuoteSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().regex(/^\+?[0-9 ]{10,16}$/),
    email: z.union([z.string().trim().email().max(254), z.literal("")]).optional().default(""),
    organization: z.string().trim().max(160).optional().default(""),
    preference: z.enum(["WhatsApp", "Email", "Phone call"]).default("WhatsApp"),
    notes: z.string().trim().max(2000).optional().default(""),
  }),
  items: z.array(itemSchema).min(1).max(50),
  couponCode: z.string().trim().max(40).optional().default(""),
}).strict();

export const trackQuoteSchema = z.object({
  reference: z.string().trim().min(4).max(40),
  identifier: z.string().trim().min(3).max(254),
}).strict();

export const updateQuoteSchema = z.object({
  status: z.enum(["submitted", "reviewing", "quoted", "accepted", "expired", "cancelled"]).optional(),
  subtotal: z.coerce.number().int().nonnegative().optional(),
  discount: z.coerce.number().int().nonnegative().optional(),
  total: z.coerce.number().int().nonnegative().optional(),
  expiresAt: z.coerce.date().optional(),
  internalNotes: z.string().max(5000).optional(),
  customerNotes: z.string().trim().max(2000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const couponSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9_-]+$/).transform((value) => value.toUpperCase()),
  type: z.enum(["percentage", "fixed"]),
  value: z.coerce.number().positive(),
  minimumSubtotal: z.coerce.number().int().nonnegative().optional().default(0),
  maximumDiscount: z.union([z.coerce.number().int().nonnegative(), z.literal(""), z.null()]).optional().transform((value) => value === "" ? undefined : value),
  active: z.boolean().optional().default(true),
  startsAt: z.union([z.coerce.date(), z.literal(""), z.null()]).optional().transform((value) => value === "" ? undefined : value),
  expiresAt: z.union([z.coerce.date(), z.literal(""), z.null()]).optional().transform((value) => value === "" ? undefined : value),
}).strict();

export const updateCouponSchema = couponSchema.partial().refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });
