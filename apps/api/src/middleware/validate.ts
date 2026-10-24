import type { Request, RequestHandler } from "express";
import type { ZodType } from "zod";

type Source = "body" | "query" | "params";

// Express 5 exposes `req.query` and `req.params` as getters, so assigning to them throws.
// Redefining the property on the request instance replaces the value with the parsed one.
function replace(req: Request, source: Source, value: unknown): void {
  Object.defineProperty(req, source, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

export function validate(schema: ZodType, source: Source): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    replace(req, source, result.data);
    next();
  };
}
