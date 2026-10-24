import type { Response } from "supertest";

export const REFRESH_COOKIE = "refresh_token";

export interface ParsedCookie {
  value: string;
  attributes: string[];
}

// The Set-Cookie header for the refresh cookie, split into its value and attributes.
export function refreshCookieFrom(res: Response): ParsedCookie | undefined {
  const header = res.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const raw = cookies.find((cookie) => cookie.startsWith(`${REFRESH_COOKIE}=`));
  if (!raw) return undefined;
  const [pair = "", ...attributes] = raw.split("; ");
  return { value: pair.slice(REFRESH_COOKIE.length + 1), attributes };
}

export const cookieHeader = (value: string): string => `${REFRESH_COOKIE}=${value}`;
