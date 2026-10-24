import express, { type RequestHandler } from "express";
import pino from "pino";
import request from "supertest";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { createErrorHandler } from "./error.js";

function appThatFailsWith(handler: RequestHandler) {
  const app = express();
  app.get("/boom", handler);
  app.use(createErrorHandler(pino({ level: "silent" })));
  return app;
}

describe("error handler", () => {
  it("hides the details of unexpected errors behind a generic 500", async () => {
    const app = appThatFailsWith(() => {
      throw new Error("connection to db.internal:5432 refused");
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  });

  it("turns schema failures into a 400 with field-level details", async () => {
    const app = appThatFailsWith(() => {
      z.object({ email: z.email() }).parse({ email: "nope" });
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: [{ path: "email", message: expect.any(String) as string }],
      },
    });
  });
});
