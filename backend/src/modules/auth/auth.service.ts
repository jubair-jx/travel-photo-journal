import type { Logger } from "pino";
import type { Config } from "../../config/env.js";
import { hashPassword, generateToken, hashToken } from "../../lib/crypto.js";
import { emailTaken, invalidToken } from "../../lib/errors.js";
import type { Mailer } from "../../lib/mailer.js";
import { isUniqueViolation, type PrismaClient } from "../../lib/prisma.js";
import { buildVerificationEmail } from "./auth.emails.js";
import type { RegisterInput, ResendVerificationInput, VerifyEmailInput } from "./auth.schema.js";

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// The one place that decides what a verification token is: the raw value goes into the email,
// only its hash and expiry are stored.
function newVerificationToken() {
  const token = generateToken();
  return {
    token,
    stored: {
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    },
  };
}

export interface AuthServiceDeps {
  prisma: PrismaClient;
  mailer: Mailer;
  config: Config;
  logger: Logger;
}

export function createAuthService({ prisma, mailer, config, logger }: AuthServiceDeps) {
  // Best effort: the account already exists, and "resend" is the recovery path. Holding a request
  // (or a transaction) hostage to the SMTP provider would be worse than a logged failure.
  async function sendVerificationEmail(
    userId: string,
    email: string,
    token: string,
  ): Promise<void> {
    const link = `${config.appUrl}/verify-email?token=${token}`;
    try {
      await mailer.send(buildVerificationEmail(email, link));
    } catch (err) {
      logger.error({ err, userId }, "failed to send verification email");
    }
  }

  async function register({ email, password }: RegisterInput): Promise<{ email: string }> {
    // Hash first, always: duplicate and fresh registrations then cost the same time.
    const passwordHash = await hashPassword(password);
    const { token, stored } = newVerificationToken();

    try {
      const user = await prisma.user.create({
        data: { email, passwordHash, emailVerificationTokens: { create: stored } },
        select: { id: true },
      });
      await sendVerificationEmail(user.id, email, token);
    } catch (err) {
      // The unique index is the authority on duplicates; a pre-check would race.
      if (isUniqueViolation(err)) throw emailTaken();
      throw err;
    }

    return { email };
  }

  async function verifyEmail({ token }: VerifyEmailInput): Promise<{ verified: true }> {
    const tokenHash = hashToken(token);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // Claiming and checking happen in one conditional UPDATE, so of two concurrent requests with
      // the same token exactly one can match. Unknown, used and expired tokens are indistinguishable.
      const claimed = await tx.emailVerificationToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count === 0) throw invalidToken();

      const { userId } = await tx.emailVerificationToken.findUniqueOrThrow({
        where: { tokenHash },
        select: { userId: true },
      });
      await tx.user.updateMany({
        where: { id: userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      });
    });

    return { verified: true };
  }

  async function resendVerification({
    email,
  }: ResendVerificationInput): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true },
    });

    if (user && user.emailVerifiedAt === null) {
      const { token, stored } = newVerificationToken();
      // Replace, not add: only the newest link should work.
      await prisma.$transaction([
        prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
        prisma.emailVerificationToken.create({ data: { userId: user.id, ...stored } }),
      ]);
      // Not awaited: the response must take the same time whether or not an email was sent,
      // otherwise latency reveals which addresses have unverified accounts.
      void sendVerificationEmail(user.id, email, token);
    }

    return {
      message:
        "If an unverified account exists for that email, a new verification link has been sent.",
    };
  }

  return { register, verifyEmail, resendVerification };
}

export type AuthService = ReturnType<typeof createAuthService>;
