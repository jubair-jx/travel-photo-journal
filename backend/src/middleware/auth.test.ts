import express from "express";
import { SignJWT } from "jose";
import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createAccessTokenService } from "../lib/jwt.js";
import { requireAuth } from "./auth.js";
import { createErrorHandler } from "./error.js";

const settings = {
  secret: "unit-test-secret-that-is-at-least-32-chars",
  issuer: "tpj-test",
  audience: "tpj-test-web",
};
const tokens = createAccessTokenService(settings);

const app = express();
app.get("/private", requireAuth(tokens), (req, res) => {
  res.json({ userId: req.auth?.userId });
});
app.use(createErrorHandler(pino({ level: "silent" })));

const unauthenticated = {
  success: false,
  error: { code: "UNAUTHENTICATED", message: "Authentication required" },
};

describe("requireAuth", () => {
  it("lets a valid bearer token through and exposes the user id", async () => {
    const { token } = await tokens.sign("user-42");

    const res = await request(app).get("/private").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: "user-42" });
  });

  it("answers every kind of bad credential with the same 401", async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-42")
      .setIssuer(settings.issuer)
      .setAudience(settings.audience)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(settings.secret));

    const attempts = [
      request(app).get("/private"),
      request(app).get("/private").set("Authorization", "Basic dXNlcjpwYXNz"),
      request(app).get("/private").set("Authorization", "Bearer"),
      request(app).get("/private").set("Authorization", "Bearer not-a-jwt"),
      request(app).get("/private").set("Authorization", `Bearer ${expired}`),
    ];

    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual(unauthenticated);
    }
  });
});
