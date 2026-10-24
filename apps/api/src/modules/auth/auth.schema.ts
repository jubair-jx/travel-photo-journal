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

// No length rule on login: the password policy applies when choosing one, and echoing it back here
// would only help someone probing which passwords are acceptable.
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export type LoginInput = z.infer<typeof loginSchema>;
