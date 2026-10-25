import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { AppError, databaseUnavailable, notFound, validationError } from "../lib/errors.js";
import { isDatabaseUnavailable } from "../lib/prisma.js";

export interface ErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(notFound());
};

function toBody(err: AppError): ErrorBody {
  return {
    success: false,
    error: {
      code: err.code,
      message: err.message,
      ...(err.details !== undefined && { details: err.details }),
    },
  };
}

function parserErrorType(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "type" in err && typeof err.type === "string") {
    return err.type;
  }
  return undefined;
}

// Errors raised by the HTTP stack itself (an unsupported charset, an aborted upload, a bad
// Content-Encoding) carry a 4xx status and are safe to show; without this they would become 500s.
function clientFault(err: unknown): AppError | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const status = "status" in err ? err.status : undefined;
  const exposed = "expose" in err && err.expose === true;
  if (exposed && typeof status === "number" && status >= 400 && status < 500) {
    return new AppError(status, "BAD_REQUEST", "The request could not be processed");
  }
  return undefined;
}

function normalize(err: unknown): unknown {
  if (err instanceof ZodError) return fromZod(err);
  if (parserErrorType(err) === "entity.parse.failed") {
    return new AppError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
  if (parserErrorType(err) === "entity.too.large") {
    return new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  if (isDatabaseUnavailable(err)) return databaseUnavailable();
  return clientFault(err) ?? err;
}

function fromZod(err: ZodError): AppError {
  return validationError(
    err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  );
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    const known = normalize(err);
    if (known instanceof AppError) {
      res.status(known.status).json(toBody(known));
      return;
    }

    // Only the error and request id are logged: never the body, which may hold credentials.
    logger.error({ err, reqId: req.id }, "unhandled error");
    res.status(500).json(toBody(new AppError(500, "INTERNAL_ERROR", "Something went wrong")));
  };
}
