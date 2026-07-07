import { z } from "zod";

const categoryFields = {
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(""),
  imageUrl: z.string().trim().max(1000).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
};

export const createCategorySchema = z.object(categoryFields).strict();
export const updateCategorySchema = z.object(categoryFields).partial().strict();
