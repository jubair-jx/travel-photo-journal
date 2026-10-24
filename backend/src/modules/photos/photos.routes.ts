import { Router } from "express";
import type { AccessTokenService } from "../../lib/jwt.js";
import { requireAuth } from "../../middleware/auth.js";
import { createRateLimiter } from "../../middleware/rate-limit.js";
import { acceptImage } from "../../middleware/upload.js";
import { validate } from "../../middleware/validate.js";
import { createPhotoController } from "./photos.controller.js";
import { describeFieldsSchema, listQuerySchema, photoFieldsSchema } from "./photos.schema.js";
import type { PhotoService } from "./photos.service.js";

export function createPhotosRouter(
  service: PhotoService,
  accessTokens: AccessTokenService,
): Router {
  const controller = createPhotoController(service);
  const router = Router();

  router.use(requireAuth(accessTokens));

  router.get("/", validate(listQuerySchema, "query"), controller.list);
  router.post("/", acceptImage, validate(photoFieldsSchema, "body"), controller.create);
  // Each call is a paid model request, so it has its own, tighter limit.
  router.post(
    "/describe",
    createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 30 }),
    acceptImage,
    validate(describeFieldsSchema, "body"),
    controller.describe,
  );
  router.get("/:id", controller.get);
  router.put("/:id", acceptImage, validate(photoFieldsSchema, "body"), controller.update);
  router.delete("/:id", controller.remove);

  return router;
}
