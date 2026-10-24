import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import type { Config } from "./config/env.js";
import { createAccessTokenService } from "./lib/jwt.js";
import type { Mailer } from "./lib/mailer.js";
import type { StorageService } from "./lib/storage.js";
import { createLocalFilesRouter, LocalDiskStorage } from "./lib/storage.local.js";
import type { Describer } from "./lib/describer.js";
import type { Summarizer } from "./lib/summarizer.js";
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
import { createSessionService } from "./modules/auth/session.service.js";
import { createPhotosRouter } from "./modules/photos/photos.routes.js";
import { createPhotoService } from "./modules/photos/photos.service.js";
import { createTwoFactorService } from "./modules/auth/two-factor.service.js";

export interface AppDeps {
  config: Config;
  logger: Logger;
  prisma: PrismaClient;
  mailer: Mailer;
  storage: StorageService;
  summarizer: Summarizer;
  describer: Describer;
  authRateLimits?: AuthRateLimits;
}

export function createApp(deps: AppDeps): Express {
  const app = express();

  app.set("trust proxy", deps.config.trustProxy);
  app.use(createRequestLogger(deps.logger));
  app.use(helmet());
  app.use(cors({ origin: deps.config.appUrl, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    sendSuccess(res, { status: "ok" });
  });

  const accessTokens = createAccessTokenService(deps.config.jwt);
  const authService = createAuthService(deps);
  const sessionService = createSessionService({
    prisma: deps.prisma,
    accessTokens,
    totpEncryptionKey: deps.config.totpEncryptionKey,
  });
  app.use(
    "/auth",
    createAuthRouter({
      registration: authService,
      sessions: sessionService,
      twoFactor: createTwoFactorService({ prisma: deps.prisma, config: deps.config }),
      accessTokens,
      config: deps.config,
      limits: deps.authRateLimits ?? defaultAuthRateLimits,
    }),
  );

  app.use(
    "/photos",
    createPhotosRouter(
      createPhotoService({
        prisma: deps.prisma,
        storage: deps.storage,
        summarizer: deps.summarizer,
        describer: deps.describer,
        logger: deps.logger,
      }),
      accessTokens,
    ),
  );

  // Only the development driver serves files itself; S3 links point straight at the bucket.
  if (deps.storage instanceof LocalDiskStorage) {
    app.use("/files", createLocalFilesRouter(deps.storage));
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));

  return app;
}
