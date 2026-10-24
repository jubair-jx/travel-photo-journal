import type { CookieOptions, Request, RequestHandler, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { Config } from "../../config/env.js";
import { AppError, sessionNotFound } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import { authenticatedUserId } from "../../middleware/auth.js";
import { sessionIdSchema } from "./auth.schema.js";
import type { LoginInput } from "./auth.schema.js";
import {
  REFRESH_TOKEN_TTL_MS,
  type SessionService,
  type SessionTokens,
} from "./session.service.js";

export const REFRESH_COOKIE = "refresh_token";

// The cookie parser leaves values untyped; anything that is not a string is treated as absent.
function readRefreshToken(req: Request): string | undefined {
  const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === "string" ? value : undefined;
}

export function createSessionController(service: SessionService, config: Config) {
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    // Lax still blocks cross-site POSTs (so refresh and logout cannot be forged), yet lets a
    // visitor arriving from an email link keep their session.
    sameSite: "lax",
    path: config.refreshCookiePath,
  };

  function respondWithSession(res: Response, session: SessionTokens, status = 200): void {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
    sendSuccess(
      res,
      { accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user },
      status,
    );
  }

  const login: RequestHandler<ParamsDictionary, unknown, LoginInput> = async (req, res) => {
    respondWithSession(res, await service.login(req.body, req.get("user-agent")));
  };

  const refresh: RequestHandler = async (req, res) => {
    try {
      respondWithSession(res, await service.refresh(readRefreshToken(req)));
    } catch (error) {
      // A rejected cookie is dead weight; drop it so the browser stops sending it.
      if (error instanceof AppError && error.code === "INVALID_REFRESH_TOKEN") {
        res.clearCookie(REFRESH_COOKIE, cookieOptions);
      }
      throw error;
    }
  };

  const logout: RequestHandler = async (req, res) => {
    await service.logout(readRefreshToken(req));
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    sendSuccess(res, null);
  };

  const listSessions: RequestHandler = async (req, res) => {
    sendSuccess(res, await service.listSessions(authenticatedUserId(req), readRefreshToken(req)));
  };

  const revokeSession: RequestHandler = async (req, res) => {
    // A malformed id cannot belong to anyone, so it is "not found" like any other miss.
    const id = sessionIdSchema.safeParse(req.params["id"]);
    if (!id.success) throw sessionNotFound();
    const { wasCurrent } = await service.revokeSession(
      authenticatedUserId(req),
      id.data,
      readRefreshToken(req),
    );
    if (wasCurrent) res.clearCookie(REFRESH_COOKIE, cookieOptions);
    sendSuccess(res, null);
  };

  const revokeAllSessions: RequestHandler = async (req, res) => {
    await service.revokeAllSessions(authenticatedUserId(req));
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    sendSuccess(res, null);
  };

  return { login, refresh, logout, listSessions, revokeSession, revokeAllSessions };
}
