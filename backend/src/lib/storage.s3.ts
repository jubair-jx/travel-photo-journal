import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertValidObjectKey, isValidObjectKey, type StorageService } from "./storage.js";

export interface S3StorageOptions {
  client: S3Client;
  bucket: string;
  urlTtlSeconds: number;
}

export interface S3ClientSettings {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export function createS3Client({
  endpoint,
  region,
  accessKeyId,
  secretAccessKey,
  forcePathStyle,
}: S3ClientSettings): S3Client {
  return new S3Client({
    endpoint,
    region,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// Private bucket on any S3-compatible service (Neon Object Storage, Cloudflare R2, AWS S3).
// Nothing is ever public: clients only get short-lived presigned GET links.
export class S3Storage implements StorageService {
  constructor(private readonly options: S3StorageOptions) {}

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
