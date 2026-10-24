import { z } from "zod";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "./config";

// These mirror the API's rules so mistakes are caught before a request is sent. The API remains
// the authority: it re-validates everything.
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));
const newPassword = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use 128 characters or fewer");
const text = (max: number) =>
  z.string().trim().min(1, "Required").max(max, `Use ${max} characters or fewer`);

export const registerSchema = z
  .object({ email, password: newPassword, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export type RegisterValues = z.infer<typeof registerSchema>;

// No strength rule when signing in: that applies only when choosing a password.
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const totpCodeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");
export const twoFactorCodeSchema = z.object({ code: totpCodeSchema });
export type TwoFactorCodeValues = z.infer<typeof twoFactorCodeSchema>;

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1, "Enter your password"),
  code: totpCodeSchema,
});
export type DisableTwoFactorValues = z.infer<typeof disableTwoFactorSchema>;

export const resendSchema = z.object({ email });
export type ResendValues = z.infer<typeof resendSchema>;

export const photoFieldsSchema = z.object({
  name: text(120),
  location: text(120),
  description: text(2000),
});
export type PhotoFieldValues = z.infer<typeof photoFieldsSchema>;

export function validateImage(
  file: Pick<File, "type" | "size"> | undefined,
  required: boolean,
): string | undefined {
  if (!file) return required ? "Choose an image" : undefined;
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Use a JPEG, PNG or WebP image";
  }
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 10 MB or smaller";
  return undefined;
}
