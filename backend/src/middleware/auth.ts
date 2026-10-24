import type { Request, RequestHandler } from "express";
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

// For handlers mounted behind `requireAuth`: the id of the signed-in user. The check keeps the type
// honest (`req.auth` is optional) and means a route wired up without the middleware fails closed.
export function authenticatedUserId(req: Pick<Request, "auth">): string {
  if (!req.auth) throw unauthenticated();
  return req.auth.userId;
}
