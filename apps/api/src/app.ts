import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import type { Config } from "./config/env.js";
import type { Mailer } from "./lib/mailer.js";
import type { PrismaClient } from "./lib/prisma.js";
import { sendSuccess } from "./lib/response.js";
import { createErrorHandler, notFoundHandler } from "./middleware/error.js";
import { createRequestLogger } from "./middleware/request-logger.js";
import {
  createAuthRouter,
  defaultAuthRateLimits,
  type AuthRateLimits,
} from "./modules/auth/auth.routes.js";
import { createAuthService } from "./modules/auth/auth.service.js";

export interface AppDeps {
  config: Config;
  logger: Logger;
  prisma: PrismaClient;
  mailer: Mailer;
  authRateLimits?: AuthRateLimits;
}

export function createApp(deps: AppDeps): Express {
  const app = express();

  app.set("trust proxy", deps.config.trustProxy);
  app.use(createRequestLogger(deps.logger));
  app.use(helmet());
  app.use(cors({ origin: deps.config.appUrl, credentials: true }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    sendSuccess(res, { status: "ok" });
  });

  const authService = createAuthService(deps);
  app.use("/auth", createAuthRouter(authService, deps.authRateLimits ?? defaultAuthRateLimits));

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));

  return app;
}
