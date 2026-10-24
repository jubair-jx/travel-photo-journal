import type { Request, RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import { notFound, unauthenticated, validationError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import { photoIdSchema, type ListQuery, type PhotoFields } from "./photos.schema.js";
import type { PhotoService } from "./photos.service.js";

const userIdOf = (req: Pick<Request, "auth">): string => {
  if (!req.auth) throw unauthenticated();
  return req.auth.userId;
};

// A malformed id cannot belong to anyone, so it is simply "not found" like any other miss.
const photoIdOf = (req: Request): string => {
  const parsed = photoIdSchema.safeParse(req.params["id"]);
  if (!parsed.success) throw notFound("Photo not found");
  return parsed.data;
};

export function createPhotoController(service: PhotoService) {
  const create: RequestHandler<ParamsDictionary, unknown, PhotoFields> = async (req, res) => {
    if (!req.image) throw validationError([{ path: "image", message: "An image is required" }]);
    sendSuccess(res, await service.create(userIdOf(req), req.body, req.image), 201);
  };

  const list: RequestHandler = async (req, res) => {
    // validate() has already replaced req.query with the parsed values.
    sendSuccess(res, await service.list(userIdOf(req), req.query as unknown as ListQuery));
  };

  const get: RequestHandler = async (req, res) => {
    sendSuccess(res, await service.get(userIdOf(req), photoIdOf(req)));
  };

  const update: RequestHandler<ParamsDictionary, unknown, PhotoFields> = async (req, res) => {
    sendSuccess(res, await service.update(userIdOf(req), photoIdOf(req), req.body, req.image));
  };

  const remove: RequestHandler = async (req, res) => {
    sendSuccess(res, await service.remove(userIdOf(req), photoIdOf(req)));
  };

  return { create, list, get, update, remove };
}
