import { z } from "zod";

export const updateOrderSchema = z.object({
  fulfillmentStatus: z.enum(["pending", "artwork", "production", "ready", "shipped", "delivered", "cancelled"]),
}).strict();

export const assignOrderSchema = z.object({
  assigneeId: z.union([z.string().regex(/^[a-f0-9]{24}$/i), z.null()]),
}).strict();
