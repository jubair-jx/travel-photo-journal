import "dotenv/config";
import { createApp } from "./app.js";
import { ConfigError, loadConfig } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createMailer } from "./lib/mailer.js";
import { createPrismaClient } from "./lib/prisma.js";
import { createStorage } from "./lib/storage.factory.js";
import { createDescriber } from "./lib/describer.js";
import { createSummarizer } from "./lib/summarizer.js";

function main(): void {
  const config = loadConfig(process.env);
  const logger = createLogger(config.logLevel);
  const prisma = createPrismaClient(config.databaseUrl);
  const mailer = createMailer(config.mail);
  const server = createApp({
    config,
    logger,
    prisma,
    mailer,
    storage: createStorage(config),
    summarizer: createSummarizer(config.summary),
    describer: createDescriber({
      ...(config.summary.anthropic && { anthropic: config.summary.anthropic }),
      // An image takes longer than text, so a longer deadline than summaries.
      deadlineMs: 15_000,
    }),
  }).listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv }, "api listening");
  });

  const shutdown = (signal: string, exitCode = 0): void => {
    logger.info({ signal }, "shutting down");
    // Keep-alive connections would otherwise hold close() open indefinitely.
    const forced = setTimeout(() => {
      logger.error("shutdown timed out, exiting");
      process.exit(1);
    }, 10_000);
    forced.unref();
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(exitCode));
    });
    server.closeIdleConnections();
  };
  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
  // Express reports handler errors itself. Anything arriving here escaped it, so the process state
  // is unknown: log it and restart cleanly rather than limp on.
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "unhandled rejection");
    shutdown("unhandledRejection", 1);
  });
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "uncaught exception");
    shutdown("uncaughtException", 1);
  });
}

try {
  main();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
