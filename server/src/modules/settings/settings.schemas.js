import { z } from "zod";

const normalizePhoneNumber = (value) => String(value || "").replace(/[^\d]/g, "");
const whatsappSchema = z.string()
  .trim()
  .max(30)
  .optional()
  .default("")
  .transform(normalizePhoneNumber)
  .refine((value) => !value || (value.length >= 10 && value.length <= 15), "WhatsApp number must include 10 to 15 digits");

const customPricingSchema = z.object({
  tip: z.record(z.coerce.number().int().nonnegative()).optional(),
  body: z.record(z.coerce.number().int().nonnegative()).optional(),
  base: z.record(z.coerce.number().int().nonnegative()).optional(),
  size: z.record(z.coerce.number().positive()).optional(),
  finish: z.record(z.coerce.number().int().nonnegative()).optional(),
  branding: z.record(z.coerce.number().int().nonnegative()).optional(),
  packaging: z.record(z.coerce.number().int().nonnegative()).optional(),
  delivery: z.record(z.coerce.number().int().nonnegative()).optional(),
  bulkDiscounts: z.array(z.object({
    minQuantity: z.coerce.number().int().positive(),
    rate: z.coerce.number().min(0).max(95),
  })).max(10).optional(),
}).partial().strict();

export const updateSettingsSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30).optional().default(""),
  whatsapp: whatsappSchema,
  address: z.string().trim().min(2).max(500),
  timings: z.string().trim().max(160).optional().default(""),
  mapUrl: z.string().trim().max(1000).optional().default(""),
  instagramUrl: z.string().trim().max(1000).optional().default(""),
  facebookUrl: z.string().trim().max(1000).optional().default(""),
  customPricing: customPricingSchema.optional(),
}).strict();
