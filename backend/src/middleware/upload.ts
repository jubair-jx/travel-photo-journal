import type { RequestHandler } from "express";
import { fileTypeFromBuffer } from "file-type";
import multer, { MulterError } from "multer";
import { payloadTooLarge, unsupportedMediaType, validationError } from "../lib/errors.js";

export const MAX_IMAGE_MB = 10;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

const ALLOWED = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ImageMime = keyof typeof ALLOWED;

export interface UploadedImage {
  buffer: Buffer;
  mime: ImageMime;
  ext: (typeof ALLOWED)[ImageMime];
}

declare module "express-serve-static-core" {
  interface Request {
    image?: UploadedImage;
  }
}

const isAllowed = (mime: string): mime is ImageMime => mime in ALLOWED;

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 10, fieldSize: 32 * 1024 },
}).single("image");

// Reads an optional multipart "image" field into `req.image` (and the text fields into `req.body`).
// The type comes from the file's own bytes: the filename and Content-Type the client sends are
// ignored, since both are trivially forged.
export const acceptImage: RequestHandler = (req, res, next) => {
  parser(req, res, (error: unknown) => {
    if (error instanceof MulterError) {
      next(
        error.code === "LIMIT_FILE_SIZE"
          ? payloadTooLarge(`Image must be ${MAX_IMAGE_MB} MB or smaller`)
          : validationError([{ path: error.field ?? "image", message: "Unexpected file upload" }]),
      );
      return;
    }
    if (error) {
      next(error);
      return;
    }

    const file = req.file;
    if (!file) {
      next();
      return;
    }

    void fileTypeFromBuffer(file.buffer).then(
      (detected) => {
        if (!detected || !isAllowed(detected.mime)) {
          next(unsupportedMediaType("Only JPEG, PNG and WebP images are accepted"));
          return;
        }
        req.image = { buffer: file.buffer, mime: detected.mime, ext: ALLOWED[detected.mime] };
        next();
      },
      (reason: unknown) => {
        next(reason);
      },
    );
  });
};
