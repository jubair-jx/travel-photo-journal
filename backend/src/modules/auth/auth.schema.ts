import { z } from "zod";

// Trim and lowercase before validating, so the stored address is canonical and uniqueness holds
// regardless of how the client typed it.
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

// Upper bound guards the hasher against absurdly large inputs.
const password = z.string().min(8, "Must be at least 8 characters").max(128);

export const registerSchema = z.object({ email, password });
export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z.object({ token: z.string().min(1).max(256) });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({ email });
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

const totpCode = z.string().regex(/^\d{6}$/, "Must be 6 digits");

// No length rule on login: the password policy applies when choosing one, and echoing it back here
// would only help someone probing which passwords are acceptable.
export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
  totpCode: totpCode.optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyTwoFactorSchema = z.object({ code: totpCode });
export type VerifyTwoFactorInput = z.infer<typeof verifyTwoFactorSchema>;

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1).max(128),
  code: totpCode,
});
export type DisableTwoFactorInput = z.infer<typeof disableTwoFactorSchema>;

export const sessionIdSchema = z.uuid();
