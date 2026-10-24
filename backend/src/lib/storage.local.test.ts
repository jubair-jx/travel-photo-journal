import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import pino from "pino";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createErrorHandler } from "../middleware/error.js";
import { png } from "../test/fixtures.js";
import { createLocalFilesRouter, LocalDiskStorage } from "./storage.local.js";

let dir: string;
let storage: LocalDiskStorage;
let app: express.Express;

const keyFor = (ext = "png") => `photos/${randomUUID()}/${randomUUID()}.${ext}`;
const pathOf = (url: string): string => url.replace("http://api.test", "");

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "tpj-storage-"));
  storage = new LocalDiskStorage({
    directory: dir,
    publicBaseUrl: "http://api.test",
    signingKey: Buffer.alloc(32, 5),
    urlTtlSeconds: 60,
  });
  app = express();
  app.use("/files", createLocalFilesRouter(storage));
  app.use(createErrorHandler(pino({ level: "silent" })));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("LocalDiskStorage", () => {
  it("serves an uploaded object through a signed link", async () => {
    const key = keyFor("png");
    await storage.upload(key, png, "image/png");

    const url = await storage.getSignedUrl(key);
    const res = await request(app).get(pathOf(url));

    expect(url.startsWith(`http://api.test/files/${key}?`)).toBe(true);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(Buffer.compare(res.body as Buffer, png)).toBe(0);
  });

  it("refuses a tampered signature, a different key, and an expired link", async () => {
    const key = keyFor();
    const other = keyFor();
    await storage.upload(key, png, "image/png");
    await storage.upload(other, png, "image/png");
    const signed = new URL(await storage.getSignedUrl(key));
    const expired = new URL(await storage.getSignedUrl(key, -10));

    const tampered = await request(app).get(
      `/files/${key}?expires=${signed.searchParams.get("expires")}&signature=${"0".repeat(64)}`,
    );
    const swapped = await request(app).get(`/files/${other}${signed.search}`);
    const late = await request(app).get(`/files/${key}${expired.search}`);
    const unsigned = await request(app).get(`/files/${key}`);

    for (const res of [tampered, swapped, late, unsigned]) {
      expect(res.status).toBe(403);
    }
  });

  it("answers 404 for a correctly signed link to a missing object", async () => {
    const url = await storage.getSignedUrl(keyFor());

    expect((await request(app).get(pathOf(url))).status).toBe(404);
  });

  it("deletes the object, and deleting again is harmless", async () => {
    const key = keyFor();
    await storage.upload(key, png, "image/png");
    const url = await storage.getSignedUrl(key);

    await storage.delete(key);
    await storage.delete(key);

    expect((await request(app).get(pathOf(url))).status).toBe(404);
  });

  it.each(["../../etc/passwd", "photos/../x.png", "photos/a/b.png", "photos/x/y.exe", ""])(
    "refuses the key %j before touching the disk",
    async (key) => {
      await expect(storage.upload(key, png, "image/png")).rejects.toThrow();
      await expect(storage.delete(key)).rejects.toThrow();
      await expect(storage.getSignedUrl(key)).rejects.toThrow();
      expect(await readdir(dir)).not.toContain("etc");
    },
  );
});
