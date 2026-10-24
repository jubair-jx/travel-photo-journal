import express from "express";
import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createErrorHandler } from "./error.js";
import { createRateLimiter } from "./rate-limit.js";

function buildApp(limit: number) {
  const app = express();
  app.get("/limited", createRateLimiter({ windowMs: 60_000, limit }), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(createErrorHandler(pino({ level: "silent" })));
  return app;
}

describe("rate limiter", () => {
  it("answers 429 in the error envelope once the limit is exceeded", async () => {
    const app = buildApp(2);

    await request(app).get("/limited").expect(200);
    await request(app).get("/limited").expect(200);
    const res = await request(app).get("/limited");

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests, try again later" },
    });
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });
});
