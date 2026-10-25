import type { Dispatch, UnknownAction } from "@reduxjs/toolkit";
import { API_BASE_URL } from "../lib/config";
import type { AuthPayload } from "../lib/types";
import { credentialsReceived, sessionUnavailable, signedOut } from "./slices";

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

// A slow database can take several seconds to wake; beyond this the server is treated as down.
const REFRESH_TIMEOUT_MS = 20_000;

async function requestRefresh(dispatch: Dispatch<UnknownAction>): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "same-origin",
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    if (response.status === 401) {
      // The server looked at the cookie and refused it: the session really is over.
      dispatch(signedOut());
      return false;
    }
    const body: unknown = await response.json();
    if (response.ok && isSuccess(body)) {
      dispatch(credentialsReceived(body.data));
      return true;
    }
  } catch {
    // No usable answer (offline, timeout, a non-JSON error page): fall through.
  }
  // Anything but a clear "no" says nothing about the session, so it is not ended. Signing out here
  // would send someone to the login page just because the server had a bad moment.
  dispatch(sessionUnavailable());
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
