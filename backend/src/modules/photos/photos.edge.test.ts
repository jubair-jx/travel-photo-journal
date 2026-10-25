import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ErrorBody } from "../../middleware/error.js";
import { bearerFor } from "../../test/authenticator.js";
import { resetDatabase } from "../../test/db.js";
import { createUser } from "../../test/factories.js";
import { jpeg, png } from "../../test/fixtures.js";
import { buildTestContext } from "../../test/helpers.js";

const ctx = buildTestContext();

beforeEach(async () => {
  await resetDatabase(ctx.prisma);
  ctx.storage.clear();
  ctx.summarizer.clear();
});

afterAll(async () => {
  await ctx.prisma.$disconnect();
});

const original = {
  name: "Sunrise at Phewa Lake",
  location: "Pokhara, Nepal",
  description: "We paddled out before dawn and watched the mountains turn pink above the water.",
};

async function signedInWithPhoto() {
  const user = await createUser(ctx.prisma);
  const auth = await bearerFor(user.id);
  const created = await request(ctx.app)
    .post("/photos")
    .set("Authorization", auth)
    .field("name", original.name)
    .field("location", original.location)
    .field("description", original.description)
    .attach("image", png, { filename: "a.png", contentType: "image/png" })
    .expect(201);
  const id = (created.body as { data: { id: string } }).data.id;
  return { user, auth, id };
}

const edit = (auth: string, id: string) =>
  request(ctx.app).put(`/photos/${id}`).set("Authorization", auth);
const stored = (id: string) => ctx.prisma.photo.findUniqueOrThrow({ where: { id } });

describe("PUT /photos/:id with only some fields", () => {
  it("changes just the name and leaves everything else, summary included", async () => {
    const { auth, id } = await signedInWithPhoto();
    const before = await stored(id);
    ctx.summarizer.clear();

    const res = await edit(auth, id).field("name", "Renamed");

    expect(res.status).toBe(200);
    const after = await stored(id);
    expect(after).toMatchObject({
      name: "Renamed",
      location: original.location,
      description: original.description,
      summary: before.summary,
      imageKey: before.imageKey,
    });
    expect(ctx.summarizer.inputs).toHaveLength(0);
  });

  it("regenerates the summary only when the description changes", async () => {
    const { auth, id } = await signedInWithPhoto();
    ctx.summarizer.clear();

    await edit(auth, id).field("description", "A completely different story about a night market.");

    expect(ctx.summarizer.inputs).toEqual(["A completely different story about a night market."]);
    expect((await stored(id)).summary).toBe("Summary of: A completely different");
  });

  it("accepts a JSON body from an API client", async () => {
    const { auth, id } = await signedInWithPhoto();

    const res = await edit(auth, id).send({ location: "Kathmandu" });

    expect(res.status).toBe(200);
    expect((await stored(id)).location).toBe("Kathmandu");
  });

  it("replaces just the image when only a file is sent", async () => {
    const { auth, id } = await signedInWithPhoto();
    const before = await stored(id);

    const res = await edit(auth, id).attach("image", jpeg, {
      filename: "b.jpg",
      contentType: "image/jpeg",
    });

    expect(res.status).toBe(200);
    const after = await stored(id);
    expect(after.imageKey).not.toBe(before.imageKey);
    expect(after.name).toBe(original.name);
    expect(ctx.storage.objects.has(before.imageKey)).toBe(false);
  });

  it("refuses an edit that changes nothing", async () => {
    const { auth, id } = await signedInWithPhoto();

    const res = await edit(auth, id).send({});

    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    ["a blank name", { name: "   " }],
    ["a name that is too long", { name: "x".repeat(121) }],
    ["an empty description", { description: "" }],
  ])("still validates what is sent: %s", async (_label, body) => {
    const { auth, id } = await signedInWithPhoto();

    const res = await edit(auth, id).send(body);

    expect(res.status).toBe(400);
    expect((await stored(id)).name).toBe(original.name);
  });

  it("ignores a client-supplied summary or owner", async () => {
    const { auth, id, user } = await signedInWithPhoto();
    const before = await stored(id);

    await edit(auth, id).send({ name: "ok", summary: "forged", userId: "someone-else" });

    const after = await stored(id);
    expect(after.summary).toBe(before.summary);
    expect(after.userId).toBe(user.id);
  });
});

describe("GET /photos paging edge cases", () => {
  it("answers an empty page for a page past the end, not an error", async () => {
    const { auth } = await signedInWithPhoto();

    const res = await request(ctx.app).get("/photos?page=50").set("Authorization", auth);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: { items: [], page: 50, total: 1, totalPages: 1 } });
  });

  it.each(["0", "-1", "abc", "1.5", "100001", "99999999999"])(
    "rejects page=%s with a 400 instead of failing in the database",
    async (page) => {
      const { auth } = await signedInWithPhoto();

      const res = await request(ctx.app).get(`/photos?page=${page}`).set("Authorization", auth);

      expect(res.status).toBe(400);
    },
  );

  it.each(["0", "51", "abc"])("rejects limit=%s", async (limit) => {
    const { auth } = await signedInWithPhoto();

    const res = await request(ctx.app).get(`/photos?limit=${limit}`).set("Authorization", auth);

    expect(res.status).toBe(400);
  });
});

describe("hostile or malformed input to the photo routes", () => {
  it("treats a malformed id on every verb as not found", async () => {
    const { auth } = await signedInWithPhoto();

    for (const verb of ["get", "put", "delete"] as const) {
      const res = await request(ctx.app)[verb]("/photos/not-a-uuid").set("Authorization", auth);
      expect(res.status).toBe(404);
    }
  });

  it("rejects an invalid JSON body with a 400, not a 500", async () => {
    const { auth, id } = await signedInWithPhoto();

    const res = await edit(auth, id).set("Content-Type", "application/json").send("{not json");

    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.code).toBe("INVALID_JSON");
  });

  it("rejects an unsupported charset with a 4xx, not a 500", async () => {
    const { auth, id } = await signedInWithPhoto();

    const res = await edit(auth, id)
      .set("Content-Type", "application/json; charset=bogus")
      .send("{}");

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("survives emoji and non-Latin text end to end", async () => {
    const { auth, id } = await signedInWithPhoto();

    const res = await edit(auth, id).send({ name: "海の朝 🌅", location: "São Paulo" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: { name: "海の朝 🌅", location: "São Paulo" } });
  });
});
