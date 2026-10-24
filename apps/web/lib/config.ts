// In the browser, /api is proxied to the API by Next.js. Outside a browser (the unit tests) fetch
// needs an absolute URL, so a placeholder origin is used there.
export const API_BASE_URL = typeof window === "undefined" ? "http://localhost:3000/api" : "/api";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
