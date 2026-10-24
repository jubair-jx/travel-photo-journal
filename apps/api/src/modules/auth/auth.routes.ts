import { Router } from "express";
import { createRateLimiter, type RateLimitOptions } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { createAuthController } from "./auth.controller.js";
import { registerSchema, resendVerificationSchema, verifyEmailSchema } from "./auth.schema.js";
import type { AuthService } from "./auth.service.js";

export interface AuthRateLimits {
  register: RateLimitOptions;
  verifyEmail: RateLimitOptions;
  resendVerification: RateLimitOptions;
}

const HOUR = 60 * 60 * 1000;

export const defaultAuthRateLimits: AuthRateLimits = {
  register: { windowMs: HOUR, limit: 10 },
  verifyEmail: { windowMs: 15 * 60 * 1000, limit: 30 },
  resendVerification: { windowMs: HOUR, limit: 5 },
};

export function createAuthRouter(service: AuthService, limits: AuthRateLimits): Router {
  const controller = createAuthController(service);
  const router = Router();

  router.post(
    "/register",
    createRateLimiter(limits.register),
    validate(registerSchema, "body"),
    controller.register,
  );

  router.post(
    "/verify-email",
    createRateLimiter(limits.verifyEmail),
    validate(verifyEmailSchema, "body"),
    controller.verifyEmail,
  );

  router.post(
    "/resend-verification",
    createRateLimiter(limits.resendVerification),
    validate(resendVerificationSchema, "body"),
    controller.resendVerification,
  );

  return router;
}
