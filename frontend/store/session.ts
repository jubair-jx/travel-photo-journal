import type { Dispatch, UnknownAction } from "@reduxjs/toolkit";
import { API_BASE_URL } from "../lib/config";
import type { AuthPayload } from "../lib/types";
import { credentialsReceived, signedOut } from "./slices";

interface SuccessEnvelope {
  success: true;
  data: AuthPayload;
}

const isSuccess = (body: unknown): body is SuccessEnvelope =>
  typeof body === "object" &&
  body !== null &&
  "success" in body &&
  body.success === true &&
  "data" in body;

async function requestRefresh(dispatch: Dispatch<UnknownAction>): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "same-origin",
    });
    const body: unknown = await response.json();
    if (response.ok && isSuccess(body)) {
      dispatch(credentialsReceived(body.data));
      return true;
    }
  } catch {
    // No answer is treated like a refusal: the user simply has to sign in again.
  }
  dispatch(signedOut());
  return false;
}

// The refresh cookie is single-use (the server treats a replay as theft and ends the session), so
// two refreshes must never be in flight at once. Every caller shares one request and its result.
let inFlight: Promise<boolean> | null = null;

export function restoreSession(dispatch: Dispatch<UnknownAction>): Promise<boolean> {
  inFlight ??= requestRefresh(dispatch).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
