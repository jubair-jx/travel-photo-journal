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

// A slow database can take several seconds to wake; beyond this one attempt is treated as failed.
const REFRESH_TIMEOUT_MS = 20_000;

// A sleeping host needs up to about a minute. Between failed attempts the session stays "unknown",
// so the loading screen (with its explanation) keeps showing instead of an error.
export const REFRESH_RETRY_DELAYS_MS: number[] = [3_000, 6_000];

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

type Attempt = "renewed" | "refused" | "unreachable";

async function attemptRefresh(dispatch: Dispatch<UnknownAction>): Promise<Attempt> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "same-origin",
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    if (response.status === 401) return "refused";
    const body: unknown = await response.json();
    if (response.ok && isSuccess(body)) {
      dispatch(credentialsReceived(body.data));
      return "renewed";
    }
  } catch {
    // No usable answer (offline, timeout, a non-JSON error page): fall through.
  }
  return "unreachable";
}

async function requestRefresh(dispatch: Dispatch<UnknownAction>): Promise<boolean> {
  for (let attempt = 0; ; attempt += 1) {
    const outcome = await attemptRefresh(dispatch);
    if (outcome === "renewed") return true;
    if (outcome === "refused") {
      // The server looked at the cookie and refused it: the session really is over.
      dispatch(signedOut());
      return false;
    }
    const delay = REFRESH_RETRY_DELAYS_MS[attempt];
    if (delay === undefined) break;
    await wait(delay);
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
