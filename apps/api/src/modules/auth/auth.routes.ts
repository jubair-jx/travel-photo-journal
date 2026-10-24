import { Router } from "express";
import type { Config } from "../../config/env.js";
import { createRateLimiter, type RateLimitOptions } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { createAuthController } from "./auth.controller.js";
import { createSessionController } from "./session.controller.js";
import type { SessionService } from "./session.service.js";
import {
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from "./auth.schema.js";
import type { AuthService } from "./auth.service.js";

export interface AuthRateLimits {
  register: RateLimitOptions;
  login: RateLimitOptions;
  // Refresh and logout: called routinely by the client, so a looser limit.
  session: RateLimitOptions;
  verifyEmail: RateLimitOptions;
  resendVerification: RateLimitOptions;
}

const HOUR = 60 * 60 * 1000;

export const defaultAuthRateLimits: AuthRateLimits = {
  register: { windowMs: HOUR, limit: 10 },
  login: { windowMs: 15 * 60 * 1000, limit: 10 },
  session: { windowMs: 15 * 60 * 1000, limit: 120 },
  verifyEmail: { windowMs: 15 * 60 * 1000, limit: 30 },
  resendVerification: { windowMs: HOUR, limit: 5 },
};

export function createAuthRouter(
  service: AuthService,
  sessions: SessionService,
  config: Config,
  limits: AuthRateLimits,
): Router {
  const controller = createAuthController(service);
  const session = createSessionController(sessions, config);
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

  router.post(
    "/login",
    createRateLimiter(limits.login),
    validate(loginSchema, "body"),
    session.login,
  );

  router.post("/refresh", createRateLimiter(limits.session), session.refresh);

  router.post("/logout", createRateLimiter(limits.session), session.logout);

  return router;
}
