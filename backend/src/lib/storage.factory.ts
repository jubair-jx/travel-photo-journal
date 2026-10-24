import { createHmac } from "node:crypto";
import type { Config } from "../config/env.js";
import type { StorageService } from "./storage.js";
import { LocalDiskStorage } from "./storage.local.js";
import { createR2Client, R2Storage } from "./storage.r2.js";

export function createStorage(config: Config): StorageService {
  const { storage } = config;

  if (storage.driver === "r2") {
    return new R2Storage({
      client: createR2Client(storage),
      bucket: storage.bucket,
      urlTtlSeconds: storage.urlTtlSeconds,
    });
  }

  return new LocalDiskStorage({
    directory: storage.directory,
    publicBaseUrl: storage.publicBaseUrl,
    // Derived, so the development driver needs no extra secret of its own. Links are only
    // valid for the same JWT secret, and the label keeps this key distinct from the JWT key.
    signingKey: createHmac("sha256", config.jwt.secret).update("local-storage-links").digest(),
    urlTtlSeconds: storage.urlTtlSeconds,
  });
}
