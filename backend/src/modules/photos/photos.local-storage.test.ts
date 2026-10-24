import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createStorage } from "../../lib/storage.factory.js";
import { bearerFor } from "../../test/authenticator.js";
import { resetDatabase } from "../../test/db.js";
import { createUser } from "../../test/factories.js";
import { png } from "../../test/fixtures.js";
import { FakeMailer } from "../../test/fake-mailer.js";
import { FakeSummarizer } from "../../test/fake-summarizer.js";
import { createTestPrisma } from "../../test/db.js";
import { testConfig } from "../../test/helpers.js";

// The whole photo lifecycle against the real local-disk driver, with no storage fake in between.
const prisma = createTestPrisma();
let directory: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "tpj-photos-"));
  const config = {
    ...testConfig,
    storage: {
      driver: "local" as const,
      directory,
      publicBaseUrl: "http://api.test",
      urlTtlSeconds: 900,
    },
  };
  app = createApp({
    config,
    logger: pino({ level: "silent" }),
    prisma,
    mailer: new FakeMailer(),
    storage: createStorage(config),
    summarizer: new FakeSummarizer(),
  });
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

describe("photos with local-disk storage", () => {
  it("uploads, serves the image from its signed link, and removes it on delete", async () => {
    const user = await createUser(prisma);
    const auth = await bearerFor(user.id);

    const created = await request(app)
      .post("/photos")
      .set("Authorization", auth)
      .field("name", "Lake")
      .field("location", "Pokhara")
      .field("description", "Calm water at dawn")
      .attach("image", png, { filename: "a.png", contentType: "image/png" })
      .expect(201);
    const { id, imageUrl } = (created.body as { data: { id: string; imageUrl: string } }).data;
    const link = imageUrl.replace("http://api.test", "");

    const image = await request(app).get(link);
    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(Buffer.compare(image.body as Buffer, png)).toBe(0);

    await request(app).delete(`/photos/${id}`).set("Authorization", auth).expect(200);
    expect((await request(app).get(link)).status).toBe(404);
  });

  it("does not serve an image to a link that was altered", async () => {
    const user = await createUser(prisma);
    const created = await request(app)
      .post("/photos")
      .set("Authorization", await bearerFor(user.id))
      .field("name", "Lake")
      .field("location", "Pokhara")
      .field("description", "Calm water at dawn")
      .attach("image", png, { filename: "a.png", contentType: "image/png" })
      .expect(201);
    const { imageUrl } = (created.body as { data: { imageUrl: string } }).data;

    const forged = imageUrl
      .replace("http://api.test", "")
      .replace(/signature=[0-9a-f]+/, "signature=0");

    expect((await request(app).get(forged)).status).toBe(403);
  });
});
