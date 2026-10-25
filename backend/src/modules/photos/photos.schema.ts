import { z } from "zod";

const text = (max: number) => z.string().trim().min(1, "Required").max(max);

// `summary` is deliberately absent: the object schema drops unknown keys, so a client cannot set it.
export const photoFieldsSchema = z.object({
  name: text(120),
  location: text(120),
  description: text(2000),
});
export type PhotoFields = z.infer<typeof photoFieldsSchema>;

// An edit may change any of the fields (and/or the image); what is not sent stays as it is.
// A PUT with no body at all arrives as undefined; it is the same "nothing to change" as {}, so the
// controller can answer it with its own clearer message.
export const photoUpdateSchema = z.preprocess(
  (body: unknown) => body ?? {},
  photoFieldsSchema.partial(),
);
export type PhotoUpdate = z.infer<typeof photoUpdateSchema>;

// Optional context for the AI description; nothing here is stored.
export const describeFieldsSchema = z.object({
  name: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
});
export type DescribeFields = z.infer<typeof describeFieldsSchema>;

export const listQuerySchema = z.object({
  // The upper bound keeps skip = (page - 1) * limit inside what the database can represent.
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const photoIdSchema = z.uuid();
