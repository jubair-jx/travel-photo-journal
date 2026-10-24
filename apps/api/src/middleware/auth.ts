import type { RequestHandler } from "express";
import { unauthenticated } from "../lib/errors.js";
import type { AccessTokenService } from "../lib/jwt.js";

declare module "express-serve-static-core" {
  interface Request {
    auth?: { userId: string };
  }
}

const BEARER = /^Bearer (\S+)$/;

export function requireAuth(tokens: AccessTokenService): RequestHandler {
  return async (req, _res, next) => {
    const token = BEARER.exec(req.headers.authorization ?? "")?.[1];
    if (!token) {
      next(unauthenticated());
      return;
    }

    try {
      req.auth = await tokens.verify(token);
      next();
    } catch {
      // Expired, forged, wrong audience... the caller learns nothing beyond "not authenticated".
      next(unauthenticated());
    }
  };
}
