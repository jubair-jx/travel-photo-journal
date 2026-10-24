import express from "express";
import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createErrorHandler, type ErrorBody } from "./error.js";
import { validate } from "./validate.js";

const bodySchema = z.object({ email: z.email().toLowerCase() });
const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1) });

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post("/echo", validate(bodySchema, "body"), (req, res) => {
    res.json(req.body);
  });
  app.get("/list", validate(querySchema, "query"), (req, res) => {
    res.json(req.query);
  });
  app.use(createErrorHandler(pino({ level: "silent" })));
  return app;
}

describe("validate", () => {
  it("rejects invalid input with 400 and the failing field", async () => {
    const res = await request(buildApp()).post("/echo").send({ email: "nope" });

    const body = res.body as ErrorBody;
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toMatchObject([{ path: "email" }]);
  });

  it("hands the handler the parsed value, with unknown fields dropped", async () => {
    const res = await request(buildApp())
      .post("/echo")
      .send({ email: "Me@Example.COM", summary: "injected" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: "me@example.com" });
  });

  it("validates and coerces the query string", async () => {
    const ok = await request(buildApp()).get("/list?page=3");
    const bad = await request(buildApp()).get("/list?page=0");

    expect(ok.body).toEqual({ page: 3 });
    expect(bad.status).toBe(400);
  });
});
