import express, { type RequestHandler } from "express";
import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createErrorHandler } from "./error.js";

function appThatFailsWith(handler: RequestHandler) {
  const app = express();
  app.get("/boom", handler);
  app.use(createErrorHandler(pino({ level: "silent" })));
  return app;
}

describe("error handler: transient and client-side faults", () => {
  const prismaError = (code: string, name = "PrismaClientKnownRequestError") =>
    Object.assign(new Error("Transaction API error: details that must not leak"), { name, code });

  it.each(["P1001", "P1002", "P1008", "P1017", "P2024", "P2028"])(
    "answers a retryable 503 for database failure %s, without internals",
    async (code) => {
      const app = appThatFailsWith(() => {
        throw prismaError(code);
      });

      const res = await request(app).get("/boom");

      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "The service is busy right now. Please try again",
        },
      });
    },
  );

  it("treats a failed database connection at start-up the same way", async () => {
    const app = appThatFailsWith(() => {
      throw prismaError("", "PrismaClientInitializationError");
    });

    expect((await request(app).get("/boom")).status).toBe(503);
  });

  it("does not mistake an ordinary Prisma error (a unique violation) for an outage", async () => {
    const app = appThatFailsWith(() => {
      throw prismaError("P2002");
    });

    expect((await request(app).get("/boom")).status).toBe(500);
  });

  it("keeps a 4xx raised by the HTTP stack as a 4xx instead of a 500", async () => {
    const app = appThatFailsWith(() => {
      throw Object.assign(new Error("unsupported charset"), { status: 415, expose: true });
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(415);
    expect(res.body).toEqual({
      success: false,
      error: { code: "BAD_REQUEST", message: "The request could not be processed" },
    });
  });

  it("still hides a 5xx that claims to be safe to show", async () => {
    const app = appThatFailsWith(() => {
      throw Object.assign(new Error("secret"), { status: 502, expose: true });
    });

    expect((await request(app).get("/boom")).status).toBe(500);
  });
});
