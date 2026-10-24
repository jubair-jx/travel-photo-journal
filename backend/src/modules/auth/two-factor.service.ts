import type { Config } from "../../config/env.js";
import { decryptSecret, encryptSecret, verifyPassword } from "../../lib/crypto.js";
import {
  incorrectPassword,
  invalidTotpCode,
  twoFactorAlreadyEnabled,
  twoFactorNotEnabled,
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
      select: {
        id: true,
        email: true,
        passwordHash: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
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

  async function status(userId: string): Promise<{ enabled: boolean }> {
    const user = await findUser(userId);
    return { enabled: user.twoFactorEnabled };
  }

  // Turning protection off needs the password and a current code, so a stolen access token alone
  // cannot weaken the account.
  async function disable(
    userId: string,
    { password, code }: { password: string; code: string },
  ): Promise<{ enabled: false }> {
    const user = await findUser(userId);
    if (!user.twoFactorEnabled || !user.twoFactorSecret) throw twoFactorNotEnabled();
    if (!(await verifyPassword(user.passwordHash, password))) throw incorrectPassword();

    const secret = decryptSecret(user.twoFactorSecret, key, user.id);
    if (!(await verifyTotp(secret, code))) throw invalidTotpCode();

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { enabled: false };
  }

  return { setup, confirm, status, disable };
}

export type TwoFactorService = ReturnType<typeof createTwoFactorService>;
