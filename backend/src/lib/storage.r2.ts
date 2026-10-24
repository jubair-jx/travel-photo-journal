import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertValidObjectKey, isValidObjectKey, type StorageService } from "./storage.js";

export interface R2StorageOptions {
  client: S3Client;
  bucket: string;
  urlTtlSeconds: number;
}

export interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function createR2Client({
  accountId,
  accessKeyId,
  secretAccessKey,
}: R2Credentials): S3Client {
  return new S3Client({
    // R2 ignores the region but the SDK requires one; "auto" is Cloudflare's documented value.
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// Private Cloudflare R2 bucket over the S3 API. Nothing is ever public: clients only get
// short-lived presigned GET links.
export class R2Storage implements StorageService {
  constructor(private readonly options: R2StorageOptions) {}

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    assertValidObjectKey(key);
    await this.options.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    assertValidObjectKey(key);
    // S3-compatible deletes succeed for keys that do not exist.
    await this.options.client.send(
      new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }),
    );
  }

  getSignedUrl(key: string): Promise<string> {
    if (!isValidObjectKey(key)) return Promise.reject(new Error("invalid storage key"));
    return getSignedUrl(
      this.options.client,
      new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
      { expiresIn: this.options.urlTtlSeconds },
    );
  }
}
