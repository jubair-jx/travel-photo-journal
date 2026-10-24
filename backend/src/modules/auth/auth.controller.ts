import type { RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import { sendSuccess } from "../../lib/response.js";
import type { RegisterInput, ResendVerificationInput, VerifyEmailInput } from "./auth.schema.js";
import type { AuthService } from "./auth.service.js";

export function createAuthController(service: AuthService) {
  const register: RequestHandler<ParamsDictionary, unknown, RegisterInput> = async (req, res) => {
    sendSuccess(res, await service.register(req.body), 201);
  };

  const verifyEmail: RequestHandler<ParamsDictionary, unknown, VerifyEmailInput> = async (
    req,
    res,
  ) => {
    sendSuccess(res, await service.verifyEmail(req.body));
  };

  const resendVerification: RequestHandler<
    ParamsDictionary,
    unknown,
    ResendVerificationInput
  > = async (req, res) => {
    sendSuccess(res, await service.resendVerification(req.body));
  };

  return { register, verifyEmail, resendVerification };
}
