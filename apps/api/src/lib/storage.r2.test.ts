import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { png } from "../test/fixtures.js";
import { R2Storage } from "./storage.r2.js";

const key = `photos/${randomUUID()}/${randomUUID()}.png`;

function build() {
  const client = new S3Client({
    region: "auto",
    endpoint: "https://acct123.r2.cloudflarestorage.com",
    credentials: { accessKeyId: "dummy-access-key", secretAccessKey: "dummy-secret-key" },
  });
  const send = vi.spyOn(client, "send").mockResolvedValue({} as never);
  return { storage: new R2Storage({ client, bucket: "journal-photos", urlTtlSeconds: 900 }), send };
}

describe("R2Storage", () => {
  it("uploads with the bucket, key, body and content type", async () => {
    const { storage, send } = build();

    await storage.upload(key, png, "image/png");

    const command = send.mock.calls[0]?.[0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: "journal-photos",
      Key: key,
      Body: png,
      ContentType: "image/png",
    });
  });

  it("deletes by bucket and key", async () => {
    const { storage, send } = build();

    await storage.delete(key);

    const command = send.mock.calls[0]?.[0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toMatchObject({ Bucket: "journal-photos", Key: key });
  });

  it("hands out a presigned URL that expires, computed without any network call", async () => {
    const { storage, send } = build();

    const url = new URL(await storage.getSignedUrl(key));

    expect(url.host).toBe("journal-photos.acct123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(`/${key}`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.search).not.toContain("dummy-secret-key");
    expect(send).not.toHaveBeenCalled();
  });

  it.each(["../x.png", "photos/a/b.png", ""])("refuses the key %j", async (bad) => {
    const { storage, send } = build();

    await expect(storage.upload(bad, png, "image/png")).rejects.toThrow();
    await expect(storage.delete(bad)).rejects.toThrow();
    await expect(storage.getSignedUrl(bad)).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
