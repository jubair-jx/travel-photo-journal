import type { Config } from "../../config/env.js";
import { decryptSecret, encryptSecret } from "../../lib/crypto.js";
import {
  invalidTotpCode,
  twoFactorAlreadyEnabled,
  twoFactorNotSetUp,
  unauthenticated,
} from "../../lib/errors.js";
import type { PrismaClient } from "../../lib/prisma.js";
import { newTotpSecret, qrCodeDataUrl, totpUri, verifyTotp } from "../../lib/totp.js";

export interface TwoFactorServiceDeps {
  prisma: PrismaClient;
  config: Config;
}

export interface TwoFactorSetup {
  qrCodeDataUrl: string;
  manualKey: string;
}

export function createTwoFactorService({ prisma, config }: TwoFactorServiceDeps) {
  const key = config.totpEncryptionKey;

  async function findUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, twoFactorEnabled: true, twoFactorSecret: true },
    });
    // A valid access token for a user who has since been deleted.
    if (!user) throw unauthenticated();
    return user;
  }

  async function setup(userId: string): Promise<TwoFactorSetup> {
    const user = await findUser(userId);
    if (user.twoFactorEnabled) throw twoFactorAlreadyEnabled();

    const secret = newTotpSecret();
    // Conditional on "not enabled", so a concurrent confirmation cannot be overwritten.
    const stored = await prisma.user.updateMany({
      where: { id: user.id, twoFactorEnabled: false },
      data: { twoFactorSecret: encryptSecret(secret, key, user.id) },
    });
    if (stored.count === 0) throw twoFactorAlreadyEnabled();

    return { qrCodeDataUrl: await qrCodeDataUrl(totpUri(user.email, secret)), manualKey: secret };
  }

  async function confirm(userId: string, code: string): Promise<{ enabled: true }> {
    const user = await findUser(userId);
    if (user.twoFactorEnabled) throw twoFactorAlreadyEnabled();
    if (!user.twoFactorSecret) throw twoFactorNotSetUp();

    const secret = decryptSecret(user.twoFactorSecret, key, user.id);
    if (!(await verifyTotp(secret, code))) throw invalidTotpCode();

    await prisma.user.updateMany({
      where: { id: user.id, twoFactorEnabled: false },
      data: { twoFactorEnabled: true },
    });
    return { enabled: true };
  }

  return { setup, confirm };
}

export type TwoFactorService = ReturnType<typeof createTwoFactorService>;
