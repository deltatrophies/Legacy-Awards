import { z } from "zod";

export const updateSettingsSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30).optional().default(""),
  whatsapp: z.string().trim().max(20).optional().default(""),
  address: z.string().trim().min(2).max(500),
  timings: z.string().trim().max(160).optional().default(""),
  mapUrl: z.string().trim().max(1000).optional().default(""),
  instagramUrl: z.string().trim().max(1000).optional().default(""),
  facebookUrl: z.string().trim().max(1000).optional().default(""),
}).strict();
