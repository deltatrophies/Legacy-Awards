import { z } from "zod";

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(10).max(128)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");
const salesRole = z.enum(["sales", "sales_manager"]);

export const createSalesUserSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email,
  password,
  role: salesRole.default("sales"),
  phone: z.string().trim().max(20).optional().default(""),
  jobTitle: z.string().trim().max(100).optional().default("Sales Executive"),
}).strict();

export const updateSalesUserSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  email: email.optional(),
  password: password.optional(),
  role: salesRole.optional(),
  phone: z.string().trim().max(20).optional(),
  jobTitle: z.string().trim().max(100).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });
