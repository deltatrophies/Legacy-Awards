import { z } from "zod";

export const createInquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.union([z.string().trim().regex(/^\+?[0-9 ()-]{10,20}$/), z.literal("")]).optional().default(""),
  organization: z.string().trim().min(2).max(160),
  type: z.enum(["bulk", "custom", "pricing", "general"]),
  quantity: z.preprocess((value) => value === "" || value == null ? undefined : value, z.coerce.number().int().positive().max(100000).optional()),
  event: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().max(5000).optional().default(""),
  website: z.string().max(0).optional(),
}).strict().superRefine((data, context) => {
  if (["bulk", "custom"].includes(data.type) && !data.quantity) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["quantity"], message: "Quantity is required for bulk and custom inquiries" });
  }
});

export const updateInquirySchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "closed", "spam"]),
  assignedTo: z.string().optional(),
}).strict();
