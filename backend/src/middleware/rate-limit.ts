import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { tooManyRequests } from "../lib/errors.js";

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
}

export function createRateLimiter({ windowMs, limit }: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(tooManyRequests());
    },
  });
}
