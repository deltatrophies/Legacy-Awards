import { z } from "zod";

export const updateOrderSchema = z.object({
  fulfillmentStatus: z.enum(["pending", "artwork", "production", "ready", "shipped", "delivered", "cancelled"]),
}).strict();
