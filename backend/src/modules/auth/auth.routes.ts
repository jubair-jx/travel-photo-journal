import { Router } from "express";
import type { Config } from "../../config/env.js";
import type { AccessTokenService } from "../../lib/jwt.js";
import { requireAuth } from "../../middleware/auth.js";
import { createRateLimiter, type RateLimitOptions } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { createAuthController } from "./auth.controller.js";
import {
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  verifyEmailSchema,
  verifyTwoFactorSchema,
} from "./auth.schema.js";
import type { AuthService } from "./auth.service.js";
import { createSessionController } from "./session.controller.js";
import type { SessionService } from "./session.service.js";
import { createTwoFactorController } from "./two-factor.controller.js";
import type { TwoFactorService } from "./two-factor.service.js";

export interface AuthRateLimits {
  register: RateLimitOptions;
  login: RateLimitOptions;
  // Refresh and logout: called routinely by the client, so a looser limit.
  session: RateLimitOptions;
  verifyEmail: RateLimitOptions;
  resendVerification: RateLimitOptions;
  twoFactor: RateLimitOptions;
}

const HOUR = 60 * 60 * 1000;

export const defaultAuthRateLimits: AuthRateLimits = {
  register: { windowMs: HOUR, limit: 10 },
  login: { windowMs: 15 * 60 * 1000, limit: 10 },
  session: { windowMs: 15 * 60 * 1000, limit: 120 },
  verifyEmail: { windowMs: 15 * 60 * 1000, limit: 30 },
  resendVerification: { windowMs: HOUR, limit: 5 },
  twoFactor: { windowMs: 15 * 60 * 1000, limit: 10 },
};

export interface AuthRouterDeps {
  registration: AuthService;
  sessions: SessionService;
  twoFactor: TwoFactorService;
  accessTokens: AccessTokenService;
  config: Config;
  limits: AuthRateLimits;
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const { accessTokens, limits } = deps;
  const registration = createAuthController(deps.registration);
  const session = createSessionController(deps.sessions, deps.config);
  const twoFactor = createTwoFactorController(deps.twoFactor);
  const router = Router();

  router.post(
    "/register",
    createRateLimiter(limits.register),
    validate(registerSchema, "body"),
    registration.register,
  );

  router.post(
    "/verify-email",
    createRateLimiter(limits.verifyEmail),
    validate(verifyEmailSchema, "body"),
    registration.verifyEmail,
  );

  router.post(
    "/resend-verification",
    createRateLimiter(limits.resendVerification),
    validate(resendVerificationSchema, "body"),
    registration.resendVerification,
  );

  router.post(
    "/login",
    createRateLimiter(limits.login),
    validate(loginSchema, "body"),
    session.login,
  );

  router.post("/refresh", createRateLimiter(limits.session), session.refresh);

  router.post("/logout", createRateLimiter(limits.session), session.logout);

  router.get(
    "/sessions",
    createRateLimiter(limits.session),
    requireAuth(accessTokens),
    session.listSessions,
  );

  router.delete(
    "/sessions/:id",
    createRateLimiter(limits.session),
    requireAuth(accessTokens),
    session.revokeSession,
  );

  router.delete(
    "/sessions",
    createRateLimiter(limits.session),
    requireAuth(accessTokens),
    session.revokeAllSessions,
  );

  router.post(
    "/2fa/setup",
    createRateLimiter(limits.twoFactor),
    requireAuth(accessTokens),
    twoFactor.setup,
  );

  router.post(
    "/2fa/verify",
    createRateLimiter(limits.twoFactor),
    requireAuth(accessTokens),
    validate(verifyTwoFactorSchema, "body"),
    twoFactor.confirm,
  );

  return router;
}
