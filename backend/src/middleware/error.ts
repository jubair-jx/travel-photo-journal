import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { AppError, notFound, validationError } from "../lib/errors.js";

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

function normalize(err: unknown): unknown {
  if (err instanceof ZodError) return fromZod(err);
  if (parserErrorType(err) === "entity.parse.failed") {
    return new AppError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
  if (parserErrorType(err) === "entity.too.large") {
    return new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  return err;
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
