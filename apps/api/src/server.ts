import "dotenv/config";
import { createApp } from "./app.js";
import { ConfigError, loadConfig } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createSmtpMailer } from "./lib/mailer.js";
import { createPrismaClient } from "./lib/prisma.js";

function main(): void {
  const config = loadConfig(process.env);
  const logger = createLogger(config.logLevel);
  const prisma = createPrismaClient(config.databaseUrl);
  const mailer = createSmtpMailer(config.mail);
  const server = createApp({ config, logger, prisma, mailer }).listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv }, "api listening");
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, "shutting down");
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT");
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
