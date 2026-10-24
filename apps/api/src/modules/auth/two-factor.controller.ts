import type { RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import { unauthenticated } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import type { VerifyTwoFactorInput } from "./auth.schema.js";
import type { TwoFactorService } from "./two-factor.service.js";

export function createTwoFactorController(service: TwoFactorService) {
  const setup: RequestHandler = async (req, res) => {
    if (!req.auth) throw unauthenticated();
    sendSuccess(res, await service.setup(req.auth.userId));
  };

  const confirm: RequestHandler<ParamsDictionary, unknown, VerifyTwoFactorInput> = async (
    req,
    res,
  ) => {
    if (!req.auth) throw unauthenticated();
    sendSuccess(res, await service.confirm(req.auth.userId, req.body.code));
  };

  return { setup, confirm };
}
