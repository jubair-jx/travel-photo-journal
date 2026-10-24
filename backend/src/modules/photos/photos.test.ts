import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "../../lib/logger.js";
import type { ErrorBody } from "../../middleware/error.js";
import { bearerFor } from "../../test/authenticator.js";
import { resetDatabase } from "../../test/db.js";
import { createUser } from "../../test/factories.js";
import { jpeg, oversizePng, png, textFile, webp } from "../../test/fixtures.js";
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

const fields = {
  name: "Sunrise at Phewa Lake",
  location: "Pokhara, Nepal",
  description: "We paddled out before dawn and watched the mountains turn pink above the water.",
};

interface PhotoBody {
  id: string;
  name: string;
  location: string;
  description: string;
  summary: string | null;
  imageUrl: string;
  imageMime: string;
  createdAt: string;
  updatedAt: string;
}

// Typed accessor for the `data` of a response; the type argument is the point of the helper.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const dataOf = <T>(res: request.Response): T => (res.body as { data: T }).data;

async function signedInUser(email?: string) {
  const user = await createUser(ctx.prisma, email ? { email } : {});
  return { user, auth: await bearerFor(user.id) };
}

function postPhoto(
  auth: string,
  overrides: Partial<typeof fields> & { summary?: string } = {},
  image: { buffer: Buffer; filename: string; contentType: string } | null = {
    buffer: png,
    filename: "IMG_2041 holiday.png",
    contentType: "image/png",
  },
) {
  const req = request(ctx.app).post("/photos").set("Authorization", auth);
  for (const [name, value] of Object.entries({ ...fields, ...overrides })) req.field(name, value);
  if (image) {
    req.attach("image", image.buffer, { filename: image.filename, contentType: image.contentType });
  }
  return req;
}

describe("POST /photos", () => {
  it("stores the image privately, saves the photo and returns a signed link", async () => {
    const { user, auth } = await signedInUser();

    const res = await postPhoto(auth);

    expect(res.status).toBe(201);
    const photo = dataOf<PhotoBody>(res);
    expect(photo).toMatchObject({
      ...fields,
      summary: "Summary of: We paddled out",
      imageMime: "image/png",
    });
    expect(photo.imageUrl.startsWith(`https://files.test/photos/${user.id}/`)).toBe(true);
    expect(res.body).not.toHaveProperty("data.imageKey");

    const [key] = [...ctx.storage.objects.keys()];
    expect(key).toMatch(new RegExp(`^photos/${user.id}/[0-9a-f-]{36}\\.png$`));
    expect(key).not.toContain("IMG_2041");
    const stored = await ctx.prisma.photo.findUniqueOrThrow({ where: { id: photo.id } });
    expect(stored.imageKey).toBe(key);
    expect(stored.userId).toBe(user.id);
  });
});

describe("POST /photos: the image", () => {
  it.each([
    ["JPEG", jpeg, "image/jpeg", "jpg"],
    ["PNG", png, "image/png", "png"],
    ["WebP", webp, "image/webp", "webp"],
  ])("accepts a %s and names the object after its real type", async (_name, buffer, mime, ext) => {
    const { auth } = await signedInUser();

    const res = await postPhoto(auth, {}, { buffer, filename: "photo.bin", contentType: mime });

    expect(res.status).toBe(201);
    expect(dataOf<PhotoBody>(res).imageMime).toBe(mime);
    expect([...ctx.storage.objects.keys()][0]?.endsWith(`.${ext}`)).toBe(true);
  });

  it("goes by the file's bytes, not the name or content type the client claims", async () => {
    const { auth } = await signedInUser();

    const res = await postPhoto(
      auth,
      {},
      { buffer: png, filename: "run-me.exe", contentType: "text/plain" },
    );

    expect(res.status).toBe(201);
    expect(dataOf<PhotoBody>(res).imageMime).toBe("image/png");
    expect([...ctx.storage.objects.keys()][0]).not.toContain("run-me");
  });

  it("rejects a file that is not an image even when it claims to be one", async () => {
    const { auth } = await signedInUser();

    const res = await postPhoto(
      auth,
      {},
      { buffer: textFile, filename: "x.png", contentType: "image/png" },
    );

    expect(res.status).toBe(415);
    expect((res.body as ErrorBody).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(ctx.storage.objects.size).toBe(0);
    expect(await ctx.prisma.photo.count()).toBe(0);
  });

  it("rejects an image over 5 MB", async () => {
    const { auth } = await signedInUser();

    const res = await postPhoto(
      auth,
      {},
      { buffer: oversizePng, filename: "big.png", contentType: "image/png" },
    );

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      success: false,
      error: { code: "PAYLOAD_TOO_LARGE", message: "Image must be 5 MB or smaller" },
    });
    expect(ctx.storage.objects.size).toBe(0);
  });

  it("requires an image", async () => {
    const { auth } = await signedInUser();

    const res = await postPhoto(auth, {}, null);

    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.details).toMatchObject([{ path: "image" }]);
  });

  it("refuses a file sent under an unexpected field name", async () => {
    const { auth } = await signedInUser();
    const req = request(ctx.app).post("/photos").set("Authorization", auth);
    for (const [name, value] of Object.entries(fields)) req.field(name, value);

    const res = await req.attach("photo", png, { filename: "a.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(ctx.storage.objects.size).toBe(0);
  });
});

describe("POST /photos: the text fields", () => {
  it("reports every missing or invalid field", async () => {
    const { auth } = await signedInUser();

    const res = await postPhoto(auth, { name: "  ", location: "", description: "x".repeat(2001) });

    expect(res.status).toBe(400);
    const body = res.body as ErrorBody;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toMatchObject([
      { path: "name" },
      { path: "location" },
      { path: "description" },
    ]);
    expect(ctx.storage.objects.size).toBe(0);
  });

  it("trims the text it stores", async () => {
    const { auth } = await signedInUser();

    const res = await postPhoto(auth, { name: "  Padded name  " });

    expect(dataOf<PhotoBody>(res).name).toBe("Padded name");
  });

  it("requires authentication and stores nothing without it", async () => {
    const res = await request(ctx.app)
      .post("/photos")
      .field("name", fields.name)
      .attach("image", png, { filename: "a.png", contentType: "image/png" });

    expect(res.status).toBe(401);
    expect(ctx.storage.objects.size).toBe(0);
  });
});

describe("POST /photos: the summary", () => {
  it("generates it from the description and ignores one sent by the client", async () => {
    const { auth } = await signedInUser();

    const res = await postPhoto(auth, { summary: "I wrote this myself" });

    expect(dataOf<PhotoBody>(res).summary).toBe("Summary of: We paddled out");
    expect(ctx.summarizer.inputs).toEqual([fields.description]);
  });

  it("still saves the photo, with no summary, when generation fails", async () => {
    const { auth } = await signedInUser();
    ctx.summarizer.failAll();

    const res = await postPhoto(auth);

    expect(res.status).toBe(201);
    expect(dataOf<PhotoBody>(res).summary).toBeNull();
    expect(ctx.storage.objects.size).toBe(1);
    expect(await ctx.prisma.photo.count()).toBe(1);
  });

  it("logs the failure without the description", async () => {
    const lines: string[] = [];
    const logged = buildTestContext({
      logger: createLogger("warn", { write: (l) => lines.push(l) }),
    });
    logged.summarizer.failAll();
    const user = await createUser(logged.prisma);

    await request(logged.app)
      .post("/photos")
      .set("Authorization", await bearerFor(user.id))
      .field("name", fields.name)
      .field("location", fields.location)
      .field("description", "secret diary text 12345")
      .attach("image", png, { filename: "a.png", contentType: "image/png" })
      .expect(201);

    const output = lines.join("");
    expect(output).toContain("summary generation failed");
    expect(output).not.toContain("secret diary text");
    await logged.prisma.$disconnect();
  });
});

describe("POST /photos: failures", () => {
  it("writes no row when the upload to storage fails", async () => {
    const { auth } = await signedInUser();
    ctx.storage.failNextUploads();

    const res = await postPhoto(auth);

    expect(res.status).toBe(500);
    expect(await ctx.prisma.photo.count()).toBe(0);
  });
});

async function seedPhoto(userId: string, overrides: { name?: string; minutesAgo?: number } = {}) {
  const photo = await ctx.prisma.photo.create({
    data: {
      userId,
      name: overrides.name ?? "Seeded photo",
      location: "Somewhere",
      description: "A description",
      summary: "A summary",
      imageKey: `photos/${userId}/${crypto.randomUUID()}.png`,
      imageMime: "image/png",
      createdAt: new Date(Date.now() - (overrides.minutesAgo ?? 0) * 60_000),
    },
  });
  await ctx.storage.upload(photo.imageKey, png, "image/png");
  return photo;
}

const notFoundBody = {
  success: false,
  error: { code: "NOT_FOUND", message: "Photo not found" },
};

interface ListBody {
  items: PhotoBody[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

describe("GET /photos", () => {
  it("lists only my photos, newest first, with signed links", async () => {
    const mine = await signedInUser();
    const theirs = await signedInUser("other@example.com");
    await seedPhoto(mine.user.id, { name: "older", minutesAgo: 10 });
    await seedPhoto(mine.user.id, { name: "newest", minutesAgo: 1 });
    await seedPhoto(theirs.user.id, { name: "not mine" });

    const res = await request(ctx.app).get("/photos").set("Authorization", mine.auth);

    expect(res.status).toBe(200);
    const body = dataOf<ListBody>(res);
    expect(body.items.map((p) => p.name)).toEqual(["newest", "older"]);
    expect(body).toMatchObject({ page: 1, limit: 20, total: 2, totalPages: 1 });
    expect(body.items[0]?.imageUrl.startsWith("https://files.test/photos/")).toBe(true);
  });

  it("pages through the results", async () => {
    const { user, auth } = await signedInUser();
    for (let i = 0; i < 5; i += 1) await seedPhoto(user.id, { name: `p${i}`, minutesAgo: i });

    const second = await request(ctx.app).get("/photos?page=2&limit=2").set("Authorization", auth);
    const last = await request(ctx.app).get("/photos?page=3&limit=2").set("Authorization", auth);
    const beyond = await request(ctx.app).get("/photos?page=9&limit=2").set("Authorization", auth);

    expect(dataOf<ListBody>(second).items.map((p) => p.name)).toEqual(["p2", "p3"]);
    expect(dataOf<ListBody>(second)).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect(dataOf<ListBody>(last).items.map((p) => p.name)).toEqual(["p4"]);
    expect(dataOf<ListBody>(beyond).items).toEqual([]);
  });

  it("returns an empty page for a new user", async () => {
    const { auth } = await signedInUser();

    const res = await request(ctx.app).get("/photos").set("Authorization", auth);

    expect(dataOf<ListBody>(res)).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });

  it.each(["page=0", "page=abc", "limit=0", "limit=51", "limit=-1"])(
    "rejects %s",
    async (query) => {
      const { auth } = await signedInUser();

      const res = await request(ctx.app).get(`/photos?${query}`).set("Authorization", auth);

      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.code).toBe("VALIDATION_ERROR");
    },
  );

  it("requires authentication", async () => {
    expect((await request(ctx.app).get("/photos")).status).toBe(401);
  });
});

describe("GET /photos/:id", () => {
  it("returns my photo", async () => {
    const { user, auth } = await signedInUser();
    const photo = await seedPhoto(user.id, { name: "mine" });

    const res = await request(ctx.app).get(`/photos/${photo.id}`).set("Authorization", auth);

    expect(res.status).toBe(200);
    expect(dataOf<PhotoBody>(res)).toMatchObject({ id: photo.id, name: "mine" });
  });

  it("answers 404, not 403, for someone else's photo, identical to a missing one", async () => {
    const mine = await signedInUser();
    const theirs = await signedInUser("other@example.com");
    const photo = await seedPhoto(theirs.user.id);

    const foreign = await request(ctx.app)
      .get(`/photos/${photo.id}`)
      .set("Authorization", mine.auth);
    const missing = await request(ctx.app)
      .get(`/photos/${crypto.randomUUID()}`)
      .set("Authorization", mine.auth);
    const malformed = await request(ctx.app)
      .get("/photos/not-a-uuid")
      .set("Authorization", mine.auth);

    for (const res of [foreign, missing, malformed]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual(notFoundBody);
    }
  });

  it("requires authentication", async () => {
    const { user } = await signedInUser();
    const photo = await seedPhoto(user.id);

    expect((await request(ctx.app).get(`/photos/${photo.id}`)).status).toBe(401);
  });
});

function putPhoto(
  auth: string,
  id: string,
  overrides: Partial<typeof fields> & { summary?: string } = {},
  image: { buffer: Buffer; filename: string; contentType: string } | null = null,
) {
  const req = request(ctx.app).put(`/photos/${id}`).set("Authorization", auth);
  for (const [name, value] of Object.entries({ ...fields, ...overrides })) req.field(name, value);
  if (image) {
    req.attach("image", image.buffer, { filename: image.filename, contentType: image.contentType });
  }
  return req;
}

describe("PUT /photos/:id", () => {
  it("updates the text fields and keeps the summary when the description is unchanged", async () => {
    const { user, auth } = await signedInUser();
    const photo = await seedPhoto(user.id);

    const res = await putPhoto(auth, photo.id, {
      name: "Renamed",
      location: "Elsewhere",
      description: photo.description,
    });

    expect(res.status).toBe(200);
    expect(dataOf<PhotoBody>(res)).toMatchObject({
      id: photo.id,
      name: "Renamed",
      location: "Elsewhere",
      summary: "A summary",
    });
    expect(ctx.summarizer.inputs).toEqual([]);
  });

  it("regenerates the summary when the description changes", async () => {
    const { user, auth } = await signedInUser();
    const photo = await seedPhoto(user.id);

    const res = await putPhoto(auth, photo.id, { description: "Completely new words here" });

    expect(dataOf<PhotoBody>(res).summary).toBe("Summary of: Completely new words");
    expect(ctx.summarizer.inputs).toEqual(["Completely new words here"]);
  });

  it("clears the summary rather than keep a stale one when regeneration fails", async () => {
    const { user, auth } = await signedInUser();
    const photo = await seedPhoto(user.id);
    ctx.summarizer.failAll();

    const res = await putPhoto(auth, photo.id, { description: "Different text now" });

    expect(res.status).toBe(200);
    expect(dataOf<PhotoBody>(res).summary).toBeNull();
    const stored = await ctx.prisma.photo.findUniqueOrThrow({ where: { id: photo.id } });
    expect(stored.description).toBe("Different text now");
    expect(stored.summary).toBeNull();
  });

  it("ignores a summary sent by the client", async () => {
    const { user, auth } = await signedInUser();
    const photo = await seedPhoto(user.id);

    const res = await putPhoto(auth, photo.id, {
      description: photo.description,
      summary: "forged",
    });

    expect(dataOf<PhotoBody>(res).summary).toBe("A summary");
  });

  it("replaces the image and removes the old file", async () => {
    const { user, auth } = await signedInUser();
    const photo = await seedPhoto(user.id);

    const res = await putPhoto(
      auth,
      photo.id,
      {},
      { buffer: webp, filename: "new.webp", contentType: "image/webp" },
    );

    expect(res.status).toBe(200);
    expect(dataOf<PhotoBody>(res).imageMime).toBe("image/webp");
    const stored = await ctx.prisma.photo.findUniqueOrThrow({ where: { id: photo.id } });
    expect(stored.imageKey).not.toBe(photo.imageKey);
    expect(stored.imageKey.endsWith(".webp")).toBe(true);
    expect(ctx.storage.objects.has(stored.imageKey)).toBe(true);
    expect(ctx.storage.objects.has(photo.imageKey)).toBe(false);
  });

  it("leaves everything as it was when the replacement is not an image", async () => {
    const { user, auth } = await signedInUser();
    const photo = await seedPhoto(user.id);

    const res = await putPhoto(
      auth,
      photo.id,
      { name: "Changed" },
      { buffer: textFile, filename: "a.png", contentType: "image/png" },
    );

    expect(res.status).toBe(415);
    const stored = await ctx.prisma.photo.findUniqueOrThrow({ where: { id: photo.id } });
    expect(stored.name).toBe(photo.name);
    expect(ctx.storage.objects.has(photo.imageKey)).toBe(true);
    expect(ctx.storage.objects.size).toBe(1);
  });

  it("requires all three text fields", async () => {
    const { user, auth } = await signedInUser();
    const photo = await seedPhoto(user.id);

    const res = await request(ctx.app)
      .put(`/photos/${photo.id}`)
      .set("Authorization", auth)
      .field("name", "Only a name");

    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.details).toMatchObject([
      { path: "location" },
      { path: "description" },
    ]);
  });

  it("cannot edit someone else's photo: 404, nothing written, nothing uploaded", async () => {
    const mine = await signedInUser();
    const theirs = await signedInUser("other@example.com");
    const photo = await seedPhoto(theirs.user.id);

    const res = await putPhoto(
      mine.auth,
      photo.id,
      { name: "Hijacked" },
      { buffer: png, filename: "a.png", contentType: "image/png" },
    );

    expect(res.status).toBe(404);
    expect(res.body).toEqual(notFoundBody);
    const stored = await ctx.prisma.photo.findUniqueOrThrow({ where: { id: photo.id } });
    expect(stored).toMatchObject({ name: photo.name, imageKey: photo.imageKey });
    expect([...ctx.storage.objects.keys()]).toEqual([photo.imageKey]);
    expect(ctx.summarizer.inputs).toEqual([]);
  });

  it("answers 404 for a missing or malformed id, and 401 without a token", async () => {
    const { auth } = await signedInUser();

    expect((await putPhoto(auth, crypto.randomUUID())).status).toBe(404);
    expect((await putPhoto(auth, "nope")).status).toBe(404);
    expect((await request(ctx.app).put(`/photos/${crypto.randomUUID()}`)).status).toBe(401);
  });
});

describe("DELETE /photos/:id", () => {
  it("removes the row and the stored file", async () => {
    const { user, auth } = await signedInUser();
    const photo = await seedPhoto(user.id);

    const res = await request(ctx.app).delete(`/photos/${photo.id}`).set("Authorization", auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: null });
    expect(await ctx.prisma.photo.count()).toBe(0);
    expect(ctx.storage.objects.has(photo.imageKey)).toBe(false);
    expect(ctx.storage.deleted).toEqual([photo.imageKey]);
  });

  it("still succeeds if the file cannot be removed, rather than leave a row pointing at nothing", async () => {
    const { user, auth } = await signedInUser();
    const photo = await seedPhoto(user.id);
    ctx.storage.failNextDeletes();

    const res = await request(ctx.app).delete(`/photos/${photo.id}`).set("Authorization", auth);

    expect(res.status).toBe(200);
    expect(await ctx.prisma.photo.count()).toBe(0);
  });

  it("cannot delete someone else's photo: 404 and both row and file survive", async () => {
    const mine = await signedInUser();
    const theirs = await signedInUser("other@example.com");
    const photo = await seedPhoto(theirs.user.id);

    const res = await request(ctx.app)
      .delete(`/photos/${photo.id}`)
      .set("Authorization", mine.auth);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(notFoundBody);
    expect(await ctx.prisma.photo.count()).toBe(1);
    expect(ctx.storage.objects.has(photo.imageKey)).toBe(true);
    expect(ctx.storage.deleted).toEqual([]);
  });

  it("is not repeatable, and needs a token", async () => {
    const { user, auth } = await signedInUser();
    const photo = await seedPhoto(user.id);
    await request(ctx.app).delete(`/photos/${photo.id}`).set("Authorization", auth).expect(200);

    expect(
      (await request(ctx.app).delete(`/photos/${photo.id}`).set("Authorization", auth)).status,
    ).toBe(404);
    expect((await request(ctx.app).delete(`/photos/${photo.id}`)).status).toBe(401);
  });
});
