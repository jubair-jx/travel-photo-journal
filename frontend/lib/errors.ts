import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ApiError } from "./types";

export const isApiError = (value: unknown): value is ApiError =>
  typeof value === "object" &&
  value !== null &&
  "status" in value &&
  typeof value.status === "number" &&
  "code" in value &&
  typeof value.code === "string" &&
  "message" in value &&
  typeof value.message === "string";

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

export const errorMessage = (error: unknown): string =>
  isApiError(error) ? error.message : GENERIC_MESSAGE;

// Puts the API's per-field problems onto the matching form fields. Returns whether any landed, so
// the caller knows whether the error still needs a general message of its own.
export function applyFieldIssues<T extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  let applied = false;
  for (const issue of error.details ?? []) {
    const field = fields.find((candidate) => candidate === issue.path);
    if (field) {
      setError(field, { type: "server", message: issue.message });
      applied = true;
    }
  }
  return applied;
}
