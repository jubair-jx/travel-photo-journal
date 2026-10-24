import type { Request, RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import { photoNotFound, validationError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import { authenticatedUserId } from "../../middleware/auth.js";
import { photoIdSchema, type ListQuery, type PhotoFields } from "./photos.schema.js";
import type { PhotoService } from "./photos.service.js";

// A malformed id cannot belong to anyone, so it is simply "not found" like any other miss.
const photoIdOf = (req: Request): string => {
  const parsed = photoIdSchema.safeParse(req.params["id"]);
  if (!parsed.success) throw photoNotFound();
  return parsed.data;
};

export function createPhotoController(service: PhotoService) {
  const create: RequestHandler<ParamsDictionary, unknown, PhotoFields> = async (req, res) => {
    if (!req.image) throw validationError([{ path: "image", message: "An image is required" }]);
    sendSuccess(res, await service.create(authenticatedUserId(req), req.body, req.image), 201);
  };

  const list: RequestHandler = async (req, res) => {
    // validate() has already replaced req.query with the parsed values.
    sendSuccess(
      res,
      await service.list(authenticatedUserId(req), req.query as unknown as ListQuery),
    );
  };

  const get: RequestHandler = async (req, res) => {
    sendSuccess(res, await service.get(authenticatedUserId(req), photoIdOf(req)));
  };

  const update: RequestHandler<ParamsDictionary, unknown, PhotoFields> = async (req, res) => {
    sendSuccess(
      res,
      await service.update(authenticatedUserId(req), photoIdOf(req), req.body, req.image),
    );
  };

  const remove: RequestHandler = async (req, res) => {
    sendSuccess(res, await service.remove(authenticatedUserId(req), photoIdOf(req)));
  };

  return { create, list, get, update, remove };
}
