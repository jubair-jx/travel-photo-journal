import { Router } from "express";
import type { AccessTokenService } from "../../lib/jwt.js";
import { requireAuth } from "../../middleware/auth.js";
import { acceptImage } from "../../middleware/upload.js";
import { validate } from "../../middleware/validate.js";
import { createPhotoController } from "./photos.controller.js";
import { listQuerySchema, photoFieldsSchema } from "./photos.schema.js";
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
  router.get("/:id", controller.get);
  router.put("/:id", acceptImage, validate(photoFieldsSchema, "body"), controller.update);
  router.delete("/:id", controller.remove);

  return router;
}
