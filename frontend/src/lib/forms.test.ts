import { describe, expect, it, vi } from "vitest";
import { applyFieldIssues, errorMessage, isApiError } from "./errors";
import {
  loginSchema,
  photoFieldsSchema,
  registerSchema,
  totpCodeSchema,
  validateImage,
} from "./schemas";
import type { ApiError } from "./types";

const issues = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => result.error?.issues.map((i) => `${String(i.path[0])}: ${i.message}`) ?? [];

describe("form schemas", () => {
  it("accepts valid registration details and normalizes the email", () => {
    const result = registerSchema.safeParse({
      email: "  Me@Example.COM ",
      password: "a-long-password",
      confirmPassword: "a-long-password",
    });

    expect(result.success && result.data.email).toBe("me@example.com");
  });

  it("rejects a short password and a mismatched confirmation", () => {
    const short = registerSchema.safeParse({
      email: "a@b.co",
      password: "short",
      confirmPassword: "short",
    });
    const mismatch = registerSchema.safeParse({
      email: "a@b.co",
      password: "a-long-password",
      confirmPassword: "a-long-passwor",
    });

    expect(issues(short)).toContain("password: Use at least 8 characters");
    expect(issues(mismatch)).toContain("confirmPassword: Passwords do not match");
  });

  it("only asks the login form for an email and a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(issues(loginSchema.safeParse({ email: "nope", password: "" }))).toEqual([
      "email: Enter a valid email address",
      "password: Enter your password",
    ]);
  });

  it.each(["123456", "000000"])("accepts the 2FA code %s", (code) => {
    expect(totpCodeSchema.safeParse(code).success).toBe(true);
  });

  it.each(["12345", "1234567", "abcdef", "12 456", ""])("rejects the 2FA code %j", (code) => {
    expect(totpCodeSchema.safeParse(code).success).toBe(false);
  });

  it("applies the same length limits as the API to photo text", () => {
    const ok = { name: "Lake", location: "Pokhara", description: "Calm" };

    expect(photoFieldsSchema.safeParse(ok).success).toBe(true);
    expect(photoFieldsSchema.safeParse({ ...ok, name: "x".repeat(121) }).success).toBe(false);
    expect(photoFieldsSchema.safeParse({ ...ok, description: "x".repeat(2001) }).success).toBe(
      false,
    );
    expect(photoFieldsSchema.safeParse({ ...ok, location: "   " }).success).toBe(false);
  });
});

describe("validateImage", () => {
  const file = (type: string, size: number) => ({ type, size }) as File;

  it("requires an image when asked to", () => {
    expect(validateImage(undefined, true)).toBe("Choose an image");
    expect(validateImage(undefined, false)).toBeUndefined();
  });

  it("accepts JPEG, PNG and WebP up to 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateImage(file(type, 5 * 1024 * 1024), true)).toBeUndefined();
    }
  });

  it("rejects other types and anything over 5 MB", () => {
    expect(validateImage(file("image/gif", 10), true)).toBe("Use a JPEG, PNG or WebP image");
    expect(validateImage(file("application/pdf", 10), true)).toBe("Use a JPEG, PNG or WebP image");
    expect(validateImage(file("image/png", 5 * 1024 * 1024 + 1), true)).toBe(
      "Image must be 5 MB or smaller",
    );
  });
});

describe("API error helpers", () => {
  const apiError = (overrides: Partial<ApiError> = {}): ApiError => ({
    status: 400,
    code: "VALIDATION_ERROR",
    message: "Invalid request",
    ...overrides,
  });

  it("recognizes the normalized error shape only", () => {
    expect(isApiError(apiError())).toBe(true);
    expect(isApiError(new Error("x"))).toBe(false);
    expect(isApiError(undefined)).toBe(false);
    expect(isApiError({ code: "X" })).toBe(false);
  });

  it("falls back to a generic message for anything unrecognized", () => {
    expect(errorMessage(apiError({ message: "Image must be 5 MB or smaller" }))).toBe(
      "Image must be 5 MB or smaller",
    );
    expect(errorMessage(undefined)).toBe("Something went wrong. Please try again.");
  });

  it("puts API field issues on the matching form fields and reports whether any matched", () => {
    const setError = vi.fn();
    const error = apiError({
      details: [
        { path: "email", message: "Invalid email" },
        { path: "image", message: "An image is required" },
        { path: "somethingElse", message: "ignored" },
      ],
    });

    const handled = applyFieldIssues(error, setError, ["email", "password"]);

    expect(handled).toBe(true);
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith("email", { type: "server", message: "Invalid email" });
  });

  it("reports false when nothing matched, so the caller can show a general message", () => {
    const setError = vi.fn();

    expect(
      applyFieldIssues(apiError({ details: [{ path: "x", message: "m" }] }), setError, ["email"]),
    ).toBe(false);
    expect(applyFieldIssues(apiError(), setError, ["email"])).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
