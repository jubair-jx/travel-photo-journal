export interface StorageService {
  upload(key: string, body: Buffer, contentType: string): Promise<void>;
  // Deleting a key that does not exist is not an error.
  delete(key: string): Promise<void>;
  // A time-limited link that lets a client fetch the object without any other credentials.
  getSignedUrl(key: string): Promise<string>;
}

// photos/<user id>/<random id>.<ext>: the only shape the application ever generates. Storage
// drivers refuse anything else, which also rules out path traversal.
const OBJECT_KEY = /^photos\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const isValidObjectKey = (key: string): boolean => OBJECT_KEY.test(key);

export function assertValidObjectKey(key: string): void {
  if (!isValidObjectKey(key)) throw new Error("invalid storage key");
}
