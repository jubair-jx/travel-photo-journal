import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createSummarizer,
  OpenRouterSummarizer,
  SummaryError,
  type OpenRouterOptions,
} from "./summarizer.js";

interface Behaviour {
  status?: number;
  content?: unknown;
  delayMs?: number;
  rawBody?: string;
}

interface Received {
  authorization: string | undefined;
  body: { model: string; messages: { role: string; content: string }[]; [key: string]: unknown };
}

// A stand-in for the OpenRouter chat completions endpoint, keyed by model name.
let server: Server;
let baseUrl: string;
let behaviours: Record<string, Behaviour>;
let received: Received[];

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString()) as Received["body"];
      received.push({ authorization: req.headers.authorization, body });
      const behaviour = behaviours[body.model] ?? {};
      setTimeout(() => {
        res.statusCode = behaviour.status ?? 200;
        res.setHeader("content-type", "application/json");
        res.end(
          behaviour.rawBody ??
            JSON.stringify({ choices: [{ message: { content: behaviour.content ?? "ok" } }] }),
        );
      }, behaviour.delayMs ?? 0);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  behaviours = {};
  received = [];
});

const options = (overrides: Partial<OpenRouterOptions> = {}): OpenRouterOptions => ({
  apiKey: "test-key",
  models: ["primary/model", "backup/model"],
  baseUrl,
  deadlineMs: 2000,
  ...overrides,
});

describe("OpenRouterSummarizer", () => {
  it("returns the trimmed summary from the first model", async () => {
    behaviours["primary/model"] = { content: "  A calm morning on the lake.  " };

    const summary = await new OpenRouterSummarizer(options()).summarize("Long text about a lake");

    expect(summary).toBe("A calm morning on the lake.");
    expect(received).toHaveLength(1);
    expect(received[0]?.authorization).toBe("Bearer test-key");
    expect(received[0]?.body.model).toBe("primary/model");
    expect(received[0]?.body.messages.at(-1)).toEqual({
      role: "user",
      content: "Long text about a lake",
    });
  });

  it("falls back to the next model when one fails or answers nonsense", async () => {
    behaviours["primary/model"] = { status: 503 };
    behaviours["backup/model"] = { content: "From the backup." };

    const summary = await new OpenRouterSummarizer(options()).summarize("text");
    expect(summary).toBe("From the backup.");
    expect(received.map((r) => r.body.model)).toEqual(["primary/model", "backup/model"]);

    received = [];
    behaviours["primary/model"] = { rawBody: JSON.stringify({ choices: [] }) };
    expect(await new OpenRouterSummarizer(options()).summarize("text")).toBe("From the backup.");

    received = [];
    behaviours["primary/model"] = { content: "   " };
    expect(await new OpenRouterSummarizer(options()).summarize("text")).toBe("From the backup.");
  });

  it("fails with a SummaryError that mentions neither the text nor the key", async () => {
    behaviours["primary/model"] = { status: 500 };
    behaviours["backup/model"] = { status: 429 };

    const attempt = new OpenRouterSummarizer(options()).summarize("my very private diary entry");

    await expect(attempt).rejects.toBeInstanceOf(SummaryError);
    await attempt.catch((error: unknown) => {
      expect((error as Error).message).not.toContain("private diary");
      expect((error as Error).message).not.toContain("test-key");
      expect((error as Error).message).toContain("primary/model");
    });
  });

  it("gives up at the overall deadline instead of trying every model for its full time", async () => {
    behaviours["primary/model"] = { delayMs: 1000 };

    const started = Date.now();
    await expect(
      new OpenRouterSummarizer(options({ deadlineMs: 150 })).summarize("text"),
    ).rejects.toBeInstanceOf(SummaryError);

    expect(Date.now() - started).toBeLessThan(700);
    expect(received.map((r) => r.body.model)).toEqual(["primary/model"]);
  });

  it("caps the length of what it returns", async () => {
    behaviours["primary/model"] = { content: "x".repeat(2000) };

    const summary = await new OpenRouterSummarizer(options()).summarize("text");

    expect(summary).toHaveLength(300);
  });

  it("sends only the model, the messages and sampling limits", async () => {
    await new OpenRouterSummarizer(options()).summarize("text");

    expect(Object.keys(received[0]?.body ?? {}).sort()).toEqual([
      "max_tokens",
      "messages",
      "model",
      "temperature",
    ]);
  });
});

describe("createSummarizer", () => {
  it("is switched off without an API key or models, and makes no request", async () => {
    expect(
      await createSummarizer({ models: ["a"], baseUrl, deadlineMs: 100 }).summarize("t"),
    ).toBeNull();
    expect(
      await createSummarizer({ apiKey: "k", models: [], baseUrl, deadlineMs: 100 }).summarize("t"),
    ).toBeNull();
    expect(received).toHaveLength(0);
  });
});
