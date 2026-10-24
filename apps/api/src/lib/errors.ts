export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (message = "Route not found"): AppError =>
  new AppError(404, "NOT_FOUND", message);

export const validationError = (details?: unknown, message = "Invalid request"): AppError =>
  new AppError(400, "VALIDATION_ERROR", message, details);

export const tooManyRequests = (): AppError =>
  new AppError(429, "RATE_LIMITED", "Too many requests, try again later");

export const emailTaken = (): AppError =>
  new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");

export const invalidToken = (): AppError =>
  new AppError(400, "INVALID_TOKEN", "Verification link is invalid or has expired");
