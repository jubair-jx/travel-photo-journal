import { z } from "zod";

const text = (max: number) => z.string().trim().min(1, "Required").max(max);

// `summary` is deliberately absent: the object schema drops unknown keys, so a client cannot set it.
export const photoFieldsSchema = z.object({
  name: text(120),
  location: text(120),
  description: text(2000),
});
export type PhotoFields = z.infer<typeof photoFieldsSchema>;

// Optional context for the AI description; nothing here is stored.
export const describeFieldsSchema = z.object({
  name: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
});
export type DescribeFields = z.infer<typeof describeFieldsSchema>;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const photoIdSchema = z.uuid();
