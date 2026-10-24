import type { RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import { sendSuccess } from "../../lib/response.js";
import { authenticatedUserId } from "../../middleware/auth.js";
import type { DisableTwoFactorInput, VerifyTwoFactorInput } from "./auth.schema.js";
import type { TwoFactorService } from "./two-factor.service.js";

export function createTwoFactorController(service: TwoFactorService) {
  const setup: RequestHandler = async (req, res) => {
    sendSuccess(res, await service.setup(authenticatedUserId(req)));
  };

  const confirm: RequestHandler<ParamsDictionary, unknown, VerifyTwoFactorInput> = async (
    req,
    res,
  ) => {
    sendSuccess(res, await service.confirm(authenticatedUserId(req), req.body.code));
  };

  const status: RequestHandler = async (req, res) => {
    sendSuccess(res, await service.status(authenticatedUserId(req)));
  };

  const disable: RequestHandler<ParamsDictionary, unknown, DisableTwoFactorInput> = async (
    req,
    res,
  ) => {
    sendSuccess(res, await service.disable(authenticatedUserId(req), req.body));
  };

  return { setup, confirm, status, disable };
}
