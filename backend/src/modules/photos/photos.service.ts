import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import { DescribeError, MAX_DESCRIBE_BYTES, type Describer } from "../../lib/describer.js";
import { aiUnavailable, payloadTooLarge, photoNotFound } from "../../lib/errors.js";
import { isRecordNotFound, type Photo, type PrismaClient } from "../../lib/prisma.js";
import type { StorageService } from "../../lib/storage.js";
import { SummaryError, type Summarizer } from "../../lib/summarizer.js";
import type { UploadedImage } from "../../middleware/upload.js";
import type { ListQuery, PhotoFields } from "./photos.schema.js";

export interface PhotoServiceDeps {
  prisma: PrismaClient;
  storage: StorageService;
  summarizer: Summarizer;
  describer: Describer;
  logger: Logger;
}

export interface PhotoView {
  id: string;
  name: string;
  location: string;
  description: string;
  summary: string | null;
  imageUrl: string;
  imageMime: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PhotoPage {
  items: PhotoView[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function createPhotoService({
  prisma,
  storage,
  summarizer,
  describer,
  logger,
}: PhotoServiceDeps) {
  async function toView(photo: Photo): Promise<PhotoView> {
    return {
      id: photo.id,
      name: photo.name,
      location: photo.location,
      description: photo.description,
      summary: photo.summary,
      imageUrl: await storage.getSignedUrl(photo.imageKey),
      imageMime: photo.imageMime,
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt,
    };
  }

  // A summary is a nicety: any failure, including a slow provider, leaves it empty and never blocks
  // the save. The log carries a reason only, never the description.
  async function summarize(description: string): Promise<string | null> {
    try {
      return await summarizer.summarize(description);
    } catch (error) {
      logger.warn(
        { reason: error instanceof SummaryError ? error.message : "unexpected summarizer error" },
        "summary generation failed",
      );
      return null;
    }
  }

  async function discard(key: string): Promise<void> {
    try {
      await storage.delete(key);
    } catch {
      logger.error({ key }, "could not remove stored image");
    }
  }

  async function create(
    userId: string,
    fields: PhotoFields,
    image: UploadedImage,
  ): Promise<PhotoView> {
    const imageKey = `photos/${userId}/${randomUUID()}.${image.ext}`;

    const [summary] = await Promise.all([
      summarize(fields.description),
      storage.upload(imageKey, image.buffer, image.mime),
    ]);

    try {
      const photo = await prisma.photo.create({
        data: { ...fields, userId, summary, imageKey, imageMime: image.mime },
      });
      return await toView(photo);
    } catch (error) {
      // Do not leave an orphaned file behind a row that was never written.
      await discard(imageKey);
      throw error;
    }
  }

  async function list(userId: string, { page, limit }: ListQuery): Promise<PhotoPage> {
    const where = { userId };
    const [rows, total] = await Promise.all([
      prisma.photo.findMany({
        where,
        // The id breaks ties so pages stay stable when several photos share a timestamp.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.photo.count({ where }),
    ]);
    return {
      items: await Promise.all(rows.map(toView)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Ownership lives in the query itself: someone else's photo is simply not found.
  async function get(userId: string, id: string): Promise<PhotoView> {
    const photo = await prisma.photo.findFirst({ where: { id, userId } });
    if (!photo) throw photoNotFound();
    return toView(photo);
  }

  async function update(
    userId: string,
    id: string,
    fields: PhotoFields,
    image: UploadedImage | undefined,
  ): Promise<PhotoView> {
    // Checked before anything is uploaded or summarized: a caller who does not own the photo
    // must not be able to cause any side effect at all.
    const existing = await prisma.photo.findFirst({ where: { id, userId } });
    if (!existing) throw photoNotFound();

    const newKey = image ? `photos/${userId}/${randomUUID()}.${image.ext}` : undefined;
    // A summary describing text that no longer exists would be wrong, so it is only reused when
    // the description is untouched; otherwise it is regenerated, or cleared if that fails.
    const summaryPromise =
      fields.description === existing.description
        ? Promise.resolve(existing.summary)
        : summarize(fields.description);

    const [summary] = await Promise.all([
      summaryPromise,
      image && newKey ? storage.upload(newKey, image.buffer, image.mime) : undefined,
    ]);

    try {
      const photo = await prisma.photo.update({
        where: { id, userId },
        data: {
          ...fields,
          summary,
          ...(image && newKey && { imageKey: newKey, imageMime: image.mime }),
        },
      });
      if (newKey) await discard(existing.imageKey);
      return await toView(photo);
    } catch (error) {
      if (newKey) await discard(newKey);
      // Deleted by someone between the lookup and the write.
      if (isRecordNotFound(error)) throw photoNotFound();
      throw error;
    }
  }

  async function remove(userId: string, id: string): Promise<null> {
    const existing = await prisma.photo.findFirst({ where: { id, userId } });
    if (!existing) throw photoNotFound();

    // Row first: a leftover file is harmless, a row pointing at a missing file is a broken photo.
    const { count } = await prisma.photo.deleteMany({ where: { id, userId } });
    if (count === 0) throw photoNotFound();
    await discard(existing.imageKey);
    return null;
  }

  // Drafts a description from the picture. Nothing is stored: the user reads it, edits it, and it is
  // only kept if they save the photo.
  async function describe(
    image: UploadedImage,
    context: { name?: string | undefined; location?: string | undefined },
  ): Promise<{ description: string }> {
    if (image.buffer.length > MAX_DESCRIBE_BYTES) {
      throw payloadTooLarge("Image is too large for an AI description");
    }
    try {
      const description = await describer.describe({
        buffer: image.buffer,
        mime: image.mime,
        name: context.name,
        location: context.location,
      });
      if (description === null) throw aiUnavailable();
      return { description };
    } catch (error) {
      if (error instanceof DescribeError) {
        logger.warn({ reason: error.message }, "description generation failed");
        throw aiUnavailable();
      }
      throw error;
    }
  }

  return { create, list, get, update, remove, describe };
}

export type PhotoService = ReturnType<typeof createPhotoService>;
