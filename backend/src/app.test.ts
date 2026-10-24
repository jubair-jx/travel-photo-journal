import request from "supertest";
import { describe, expect, it } from "vitest";
import { createLogger } from "./lib/logger.js";
import { buildTestApp, buildTestContext } from "./test/helpers.js";

describe("GET /health", () => {
  it("responds 200 in the success envelope", async () => {
    const res = await request(buildTestApp()).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: "ok" } });
  });
});

describe("unknown routes", () => {
  it("responds 404 NOT_FOUND in the error envelope", async () => {
    const res = await request(buildTestApp()).get("/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });
});

describe("request bodies", () => {
  it("rejects malformed JSON with 400 INVALID_JSON", async () => {
    const res = await request(buildTestApp())
      .post("/health")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON" },
    });
  });

  it("rejects bodies over the size limit with 413 PAYLOAD_TOO_LARGE", async () => {
    const res = await request(buildTestApp())
      .post("/health")
      .send({ blob: "x".repeat(200 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      success: false,
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" },
    });
  });
});

describe("security headers", () => {
  it("sets hardening headers and hides the framework", async () => {
    const res = await request(buildTestApp()).get("/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("CORS", () => {
  it("allows the web app origin with credentials", async () => {
    const res = await request(buildTestApp()).get("/health").set("Origin", "http://localhost:3000");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("never echoes or wildcards any other origin", async () => {
    const res = await request(buildTestApp()).get("/health").set("Origin", "https://evil.example");

    const allowed = res.headers["access-control-allow-origin"];
    expect(allowed).not.toBe("https://evil.example");
    expect(allowed).not.toBe("*");
  });
});

describe("request logging", () => {
  it("tags every response with a request id", async () => {
    const res = await request(buildTestApp()).get("/health");

    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("logs the request outcome without credentials", async () => {
    const lines: string[] = [];
    const logger = createLogger("info", { write: (line) => lines.push(line) });
    const { app } = buildTestContext({ logger });

    await request(app)
      .get("/health")
      .set("Authorization", "Bearer jwt-secret")
      .set("Cookie", "rt=cookie-secret");

    const output = lines.join("");
    expect(output).toContain("/health");
    expect(output).toContain("200");
    expect(output).not.toContain("jwt-secret");
    expect(output).not.toContain("cookie-secret");
  });
});
