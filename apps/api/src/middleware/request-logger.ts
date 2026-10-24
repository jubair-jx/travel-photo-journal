import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

export function createRequestLogger(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    // A fresh id per request; client-supplied ids are not trusted.
    genReqId: (_req, res) => {
      const id = randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
    serializers: {
      // Path only: query strings can carry tokens.
      req: (req: { id: string; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url.split("?")[0],
      }),
      // Status only: response headers would include Set-Cookie.
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  });
}
