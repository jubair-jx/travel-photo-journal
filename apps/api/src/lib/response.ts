import type { Response } from "express";

export interface SuccessBody {
  success: true;
  data: unknown;
}

export function sendSuccess(res: Response, data: unknown, status = 200): void {
  const body: SuccessBody = { success: true, data };
  res.status(status).json(body);
}
