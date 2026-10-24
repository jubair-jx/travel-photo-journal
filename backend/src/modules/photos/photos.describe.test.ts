import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ErrorBody } from "../../middleware/error.js";
import { bearerFor } from "../../test/authenticator.js";
import { resetDatabase } from "../../test/db.js";
import { createUser } from "../../test/factories.js";
import { png, textFile } from "../../test/fixtures.js";
import { buildTestContext } from "../../test/helpers.js";

const ctx = buildTestContext();

beforeEach(async () => {
  await resetDatabase(ctx.prisma);
  ctx.describer.clear();
  ctx.storage.clear();
});

afterAll(async () => {
  await ctx.prisma.$disconnect();
});

async function auth() {
  const user = await createUser(ctx.prisma);
  return bearerFor(user.id);
}

function describePhoto(
  authorization: string | undefined,
  fields: Record<string, string> = {},
  image: { buffer: Buffer; contentType: string } | null = { buffer: png, contentType: "image/png" },
) {
  const req = request(ctx.app).post("/photos/describe");
  if (authorization) req.set("Authorization", authorization);
  for (const [name, value] of Object.entries(fields)) req.field(name, value);
  if (image)
    req.attach("image", image.buffer, { filename: "pic.png", contentType: image.contentType });
  return req;
}

describe("POST /photos/describe", () => {
  it("drafts a description from the picture and the context typed so far", async () => {
    const res = await describePhoto(await auth(), { name: "Phewa Lake", location: "Pokhara" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { description: "Described: Phewa Lake" } });
    expect(ctx.describer.inputs).toHaveLength(1);
    expect(ctx.describer.inputs[0]).toMatchObject({
      name: "Phewa Lake",
      location: "Pokhara",
      mime: "image/png",
    });
  });

  it("works with no name or location yet", async () => {
    const res = await describePhoto(await auth());

    expect(res.status).toBe(200);
    expect(ctx.describer.inputs[0]?.name).toBeUndefined();
  });

  it("stores nothing: no photo row and no file", async () => {
    await describePhoto(await auth());

    expect(await ctx.prisma.photo.count()).toBe(0);
    expect(ctx.storage.objects.size).toBe(0);
  });

  it("requires authentication, and does no model work without it", async () => {
    const res = await describePhoto(undefined);

    expect(res.status).toBe(401);
    expect(ctx.describer.inputs).toHaveLength(0);
  });

  it("requires an image", async () => {
    const res = await describePhoto(await auth(), { name: "x" }, null);

    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a file that is not really an image, before any model call", async () => {
    const res = await describePhoto(
      await auth(),
      {},
      { buffer: textFile, contentType: "image/png" },
    );

    expect(res.status).toBe(415);
    expect(ctx.describer.inputs).toHaveLength(0);
  });

  it("answers 503 AI_UNAVAILABLE when the feature is switched off", async () => {
    ctx.describer.switchOff();

    const res = await describePhoto(await auth());

    expect(res.status).toBe(503);
    expect((res.body as ErrorBody).error.code).toBe("AI_UNAVAILABLE");
  });

  it("answers 503 without leaking provider details when the model call fails", async () => {
    ctx.describer.failAll();

    const res = await describePhoto(await auth());

    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain("fake");
  });
});
