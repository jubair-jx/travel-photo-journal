import type { StorageService } from "../lib/storage.js";

export class FakeStorage implements StorageService {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();
  readonly deleted: string[] = [];
  private failDeletes = false;
  private failUploads = false;

  upload(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.failUploads) return Promise.reject(new Error("storage unavailable"));
    this.objects.set(key, { body, contentType });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    if (this.failDeletes) return Promise.reject(new Error("storage unavailable"));
    this.objects.delete(key);
    this.deleted.push(key);
    return Promise.resolve();
  }

  getSignedUrl(key: string): Promise<string> {
    return Promise.resolve(`https://files.test/${key}?signature=fake&expires=900`);
  }

  failNextDeletes(): void {
    this.failDeletes = true;
  }

  failNextUploads(): void {
    this.failUploads = true;
  }

  clear(): void {
    this.objects.clear();
    this.deleted.length = 0;
    this.failDeletes = false;
    this.failUploads = false;
  }
}
