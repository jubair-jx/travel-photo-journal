import { describe, expect, it } from "vitest";
import { testConfig } from "../test/helpers.js";
import { createStorage } from "./storage.factory.js";
import { LocalDiskStorage } from "./storage.local.js";
import { S3Storage } from "./storage.s3.js";

describe("createStorage", () => {
  it("builds the local-disk driver for local config", () => {
    expect(createStorage(testConfig)).toBeInstanceOf(LocalDiskStorage);
  });

  it("builds the S3 driver for S3 config", () => {
    const storage = createStorage({
      ...testConfig,
      storage: {
        driver: "s3",
        endpoint: "https://s3.example.test",
        region: "us-east-2",
        forcePathStyle: true,
        accessKeyId: "key-id",
        secretAccessKey: "key-secret",
        bucket: "photos",
        urlTtlSeconds: 900,
      },
    });

    expect(storage).toBeInstanceOf(S3Storage);
  });

  it("derives different local link-signing keys from different JWT secrets", async () => {
    const key = `photos/${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
    const withSecret = (secret: string) =>
      createStorage({ ...testConfig, jwt: { ...testConfig.jwt, secret } });

    const a = await withSecret("a".repeat(40)).getSignedUrl(key);
    const b = await withSecret("b".repeat(40)).getSignedUrl(key);

    const signature = (url: string) => new URL(url).searchParams.get("signature");
    expect(signature(a)).not.toBe(signature(b));
  });
});
