import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { AnthropicSummarizer, createSummarizer, SummaryError } from "./summarizer.js";

const LONG_TEXT =
  "Walked along the longest natural sea beach at dawn. Fishing boats were coming in and chai stalls were opening while the sky turned orange.";

function fakeClient(reply: unknown) {
  const create = vi
    .fn()
    .mockImplementation(() =>
      reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply),
    );
  return { client: { messages: { create } } as unknown as Pick<Anthropic, "messages">, create };
}

const answer = (text: string, stopReason = "end_turn") => ({
  stop_reason: stopReason,
  content: [{ type: "text", text }],
});

const build = (client: Pick<Anthropic, "messages">) =>
  new AnthropicSummarizer({
    apiKey: "test-key",
    model: "claude-haiku-5-5",
    deadlineMs: 8000,
    client,
  });

describe("AnthropicSummarizer", () => {
  it("returns the trimmed summary", async () => {
    const { client } = fakeClient(answer("  A dawn walk on a long beach.  "));

    await expect(build(client).summarize(LONG_TEXT)).resolves.toBe("A dawn walk on a long beach.");
  });

  it("keeps the request cheap: small output, no thinking, low effort", async () => {
    const { client, create } = fakeClient(answer("Short summary."));

    await build(client).summarize(LONG_TEXT);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: 100,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages: [{ role: "user", content: LONG_TEXT }],
    });
  });

  it("skips the call for a description that is already short", async () => {
    const { client, create } = fakeClient(answer("unused"));

    await expect(build(client).summarize("A nice sunset.")).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("caps the length of what it returns", async () => {
    const { client } = fakeClient(answer("x".repeat(1000)));

    const summary = await build(client).summarize(LONG_TEXT);

    expect(summary?.length).toBe(300);
  });

  it.each([
    ["an empty reply", answer("   ")],
    ["a refusal", answer("no", "refusal")],
    ["a provider error", new Error("boom with secret prompt text")],
  ])("fails with a SummaryError on %s, without echoing the text", async (_name, reply) => {
    const { client } = fakeClient(reply);

    const failure = await build(client)
      .summarize(LONG_TEXT)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(SummaryError);
    expect((failure as Error).message).toContain("claude-haiku-5-5");
    expect((failure as Error).message).not.toContain(LONG_TEXT);
    expect((failure as Error).message).not.toContain("test-key");
  });
});

describe("createSummarizer with Anthropic", () => {
  it("prefers Anthropic when it is configured, even if OpenRouter is too", () => {
    const summarizer = createSummarizer({
      apiKey: "or-key",
      models: ["vendor/model:free"],
      baseUrl: "https://openrouter.example",
      deadlineMs: 8000,
      anthropic: { apiKey: "test-key", model: "claude-haiku-5-5" },
    });

    expect(summarizer).toBeInstanceOf(AnthropicSummarizer);
  });
});
