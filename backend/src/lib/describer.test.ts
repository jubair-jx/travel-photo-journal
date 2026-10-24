import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { AnthropicDescriber, createDescriber, DescribeError } from "./describer.js";

const image = Buffer.from("not-a-real-image-but-bytes");

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
  new AnthropicDescriber({
    apiKey: "test-key",
    model: "claude-haiku-5-5",
    deadlineMs: 15000,
    client,
  });

describe("AnthropicDescriber", () => {
  it("sends the picture as base64 with the typed context, cheaply", async () => {
    const { client, create } = fakeClient(answer("  I watched the sun come up over the water.  "));

    const result = await build(client).describe({
      buffer: image,
      mime: "image/jpeg",
      name: "Dawn",
      location: "Cox's Bazar",
    });

    expect(result).toBe("I watched the sun come up over the water.");
    const request = create.mock.calls[0]?.[0] as {
      messages: { content: { type: string; source?: unknown; text?: string }[] }[];
    };
    expect(request).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: 200,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
    });
    const [picture, text] = request.messages[0]?.content ?? [];
    expect(picture).toMatchObject({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: image.toString("base64") },
    });
    expect(text?.text).toBe("Title: Dawn\nPlace: Cox's Bazar");
  });

  it("still works with no context at all", async () => {
    const { client, create } = fakeClient(answer("A quiet street."));

    await build(client).describe({ buffer: image, mime: "image/png" });

    const request = create.mock.calls[0]?.[0] as { messages: { content: { text?: string }[] }[] };
    expect(request.messages[0]?.content[1]?.text).toBe("Describe this photo.");
  });

  it("caps the length of what it returns", async () => {
    const { client } = fakeClient(answer("x".repeat(2000)));

    const result = await build(client).describe({ buffer: image, mime: "image/png" });

    expect(result).toHaveLength(600);
  });

  it.each([
    ["an empty reply", answer("  ")],
    ["a refusal", answer("no", "refusal")],
    ["a provider error", new Error("boom")],
  ])("fails with a DescribeError on %s", async (_name, reply) => {
    const { client } = fakeClient(reply);

    const failure = await build(client)
      .describe({ buffer: image, mime: "image/png" })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(DescribeError);
    expect((failure as Error).message).not.toContain("test-key");
  });
});

describe("createDescriber", () => {
  it("is switched off without an Anthropic key and makes no request", async () => {
    await expect(
      createDescriber({ deadlineMs: 1000 }).describe({ buffer: image, mime: "image/png" }),
    ).resolves.toBeNull();
  });

  it("is on when Anthropic is configured", () => {
    const describer = createDescriber({
      anthropic: { apiKey: "test-key", model: "claude-haiku-5-5" },
      deadlineMs: 1000,
    });

    expect(describer).toBeInstanceOf(AnthropicDescriber);
  });
});
