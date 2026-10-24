import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

export const TOTP_ISSUER = "Travel Photo Journal";

// Seconds either side of "now" that a code is still accepted, to absorb clock drift between the
// server and the phone (one 30-second step).
const CLOCK_DRIFT_SECONDS = 30;

// Base32, as authenticator apps expect for manual entry.
export const newTotpSecret = (): string => generateSecret();

export const totpUri = (email: string, secret: string): string =>
  generateURI({ issuer: TOTP_ISSUER, label: email, secret });

export const qrCodeDataUrl = (uri: string): Promise<string> => QRCode.toDataURL(uri);

export async function verifyTotp(secret: string, code: string): Promise<boolean> {
  const result = await verify({ secret, token: code, epochTolerance: CLOCK_DRIFT_SECONDS });
  return result.valid;
}
