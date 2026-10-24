import { generate } from "otplib";
import { createAccessTokenService } from "../lib/jwt.js";
import { testConfig } from "./helpers.js";

// Acts like an authenticator app: turns the manual key into the code shown right now.
// `secondsAgo` produces a code from the past, which the server must reject once it is out of range.
export function authenticatorCode(manualKey: string, secondsAgo = 0): Promise<string> {
  return generate({ secret: manualKey, epoch: Math.floor(Date.now() / 1000) - secondsAgo });
}

export async function bearerFor(userId: string): Promise<string> {
  const { token } = await createAccessTokenService(testConfig.jwt).sign(userId);
  return `Bearer ${token}`;
}
