import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Router } from "express";
import { AppError, notFound } from "./errors.js";
import { assertValidObjectKey, isValidObjectKey, type StorageService } from "./storage.js";

export interface LocalDiskStorageOptions {
  directory: string;
  // Where clients reach the files route, e.g. "http://localhost:4000".
  publicBaseUrl: string;
  signingKey: Buffer;
  urlTtlSeconds: number;
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// Development and test driver: files on local disk, handed out through HMAC-signed, expiring
// links that mimic what a presigned bucket URL gives.
export class LocalDiskStorage implements StorageService {
  constructor(private readonly options: LocalDiskStorageOptions) {}

  private pathFor(key: string): string {
    assertValidObjectKey(key);
    return join(this.options.directory, ...key.split("/"));
  }

  private sign(key: string, expires: number): string {
    return createHmac("sha256", this.options.signingKey).update(`${key}\n${expires}`).digest("hex");
  }

  async upload(key: string, body: Buffer, _contentType: string): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  // `ttlSeconds` exists so tests can mint an already-expired link.
  getSignedUrl(key: string, ttlSeconds = this.options.urlTtlSeconds): Promise<string> {
    // Always a rejected promise, never a synchronous throw, whatever the key.
    if (!isValidObjectKey(key)) return Promise.reject(new Error("invalid storage key"));
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const query = new URLSearchParams({
      expires: String(expires),
      signature: this.sign(key, expires),
    });
    return Promise.resolve(`${this.options.publicBaseUrl}/files/${key}?${query.toString()}`);
  }

  isValidLink(key: string, expires: unknown, signature: unknown): boolean {
    if (!isValidObjectKey(key) || typeof expires !== "string" || typeof signature !== "string") {
      return false;
    }
    const expiresAt = Number(expires);
    if (!Number.isInteger(expiresAt) || expiresAt < Date.now() / 1000) return false;

    const expected = Buffer.from(this.sign(key, expiresAt));
    const given = Buffer.from(signature);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  async open(key: string): Promise<{ path: string; size: number } | undefined> {
    const path = this.pathFor(key);
    try {
      return { path, size: (await stat(path)).size };
    } catch {
      return undefined;
    }
  }
}

export function createLocalFilesRouter(storage: LocalDiskStorage): Router {
  const router = Router();

  router.get("/*key", async (req, res) => {
    const segments = req.params["key"];
    const key = Array.isArray(segments) ? segments.join("/") : "";

    if (!storage.isValidLink(key, req.query["expires"], req.query["signature"])) {
      throw new AppError(403, "INVALID_LINK", "This link is invalid or has expired");
    }
    const file = await storage.open(key);
    if (!file) throw notFound("File not found");

    res.setHeader(
      "Content-Type",
      CONTENT_TYPES[key.slice(key.lastIndexOf(".") + 1)] ?? "application/octet-stream",
    );
    res.setHeader("Content-Length", file.size);
    res.setHeader("Cache-Control", "private, max-age=300");
    // The web app lives on another origin and embeds these as images; helmet's default would block it.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    await pipeline(createReadStream(file.path), res);
  });

  return router;
}
