import { z } from "zod";

const productFields = {
  slug: z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sku: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  price: z.coerce.number().int().nonnegative(),
  tag: z.string().trim().max(100).optional().default(""),
  description: z.string().trim().min(10).max(2000),
  badge: z.string().trim().max(60).optional().default(""),
  images: z.array(z.object({ url: z.string().min(1), publicId: z.string().optional(), alt: z.string().max(160).optional() })).max(8).default([]),
  material: z.string().trim().max(100).optional().default(""),
  size: z.string().trim().max(100).optional().default(""),
  delivery: z.string().trim().max(100).optional().default(""),
  useCase: z.string().trim().max(160).optional().default(""),
  minOrder: z.coerce.number().int().positive().default(1),
  isActive: z.boolean().default(true),
};

export const createProductSchema = z.object(productFields).strict();
export const updateProductSchema = z.object(productFields).partial().strict();
