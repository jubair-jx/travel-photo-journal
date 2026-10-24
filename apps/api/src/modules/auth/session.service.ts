import { generateToken, hashPassword, hashToken, verifyPassword } from "../../lib/crypto.js";
import { emailNotVerified, invalidCredentials, invalidRefreshToken } from "../../lib/errors.js";
import type { AccessTokenService } from "../../lib/jwt.js";
import type { PrismaClient } from "../../lib/prisma.js";
import type { LoginInput } from "./auth.schema.js";

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionServiceDeps {
  prisma: PrismaClient;
  accessTokens: AccessTokenService;
}

export interface SessionTokens {
  accessToken: string;
  expiresIn: number;
  user: { id: string; email: string };
  // Goes to the cookie, never into the response body.
  refreshToken: string;
}

// Verified against when the email is unknown, so that path costs as much as a wrong password.
let dummyHash: Promise<string> | undefined;
const getDummyHash = (): Promise<string> => (dummyHash ??= hashPassword("timing-equalizer"));

export function createSessionService({ prisma, accessTokens }: SessionServiceDeps) {
  async function startSession(user: { id: string; email: string }): Promise<SessionTokens> {
    const refreshToken = generateToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    const { token, expiresIn } = await accessTokens.sign(user.id);
    return {
      accessToken: token,
      expiresIn,
      user: { id: user.id, email: user.email },
      refreshToken,
    };
  }

  async function login({ email, password }: LoginInput): Promise<SessionTokens> {
    const user = await prisma.user.findUnique({ where: { email } });
    const matches = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
    if (!user || !matches) throw invalidCredentials();
    // Only after the password is right: telling an outsider "unverified" would confirm the account.
    if (!user.emailVerifiedAt) throw emailNotVerified();

    return startSession(user);
  }

  // A token that was already rotated or revoked is being presented again, which means a copy of it
  // escaped. Everything issued after it in the same session is revoked, including the live token.
  async function revokeDescendants(tokenHash: string, now: Date): Promise<void> {
    const replayed = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { revokedAt: true, replacedById: true },
    });
    if (!replayed?.revokedAt) return;

    let nextId = replayed.replacedById;
    while (nextId) {
      const current: { replacedById: string | null } | null = await prisma.refreshToken.findUnique({
        where: { id: nextId },
        select: { replacedById: true },
      });
      await prisma.refreshToken.updateMany({
        where: { id: nextId, revokedAt: null },
        data: { revokedAt: now },
      });
      nextId = current?.replacedById ?? null;
    }
  }

  async function refresh(presented: string | undefined): Promise<SessionTokens> {
    if (!presented) throw invalidRefreshToken();
    const tokenHash = hashToken(presented);
    const now = new Date();

    const rotated = await prisma.$transaction(async (tx) => {
      // One conditional UPDATE decides the winner if the same token arrives twice at once.
      const claimed = await tx.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      if (claimed.count === 0) return null;

      const old = await tx.refreshToken.findUniqueOrThrow({
        where: { tokenHash },
        select: { id: true, user: { select: { id: true, email: true } } },
      });
      const refreshToken = generateToken();
      const successor = await tx.refreshToken.create({
        data: {
          userId: old.user.id,
          tokenHash: hashToken(refreshToken),
          expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
        },
        select: { id: true },
      });
      await tx.refreshToken.update({ where: { id: old.id }, data: { replacedById: successor.id } });
      return { user: old.user, refreshToken };
    });

    if (!rotated) {
      // Outside the transaction on purpose: throwing inside it would roll the revocation back.
      await revokeDescendants(tokenHash, now);
      throw invalidRefreshToken();
    }

    const { token, expiresIn } = await accessTokens.sign(rotated.user.id);
    return {
      accessToken: token,
      expiresIn,
      user: rotated.user,
      refreshToken: rotated.refreshToken,
    };
  }

  // Revoking the live token ends the session: every earlier token in the chain is already spent.
  // Idempotent by design, so an unknown or missing token is not an error.
  async function logout(presented: string | undefined): Promise<void> {
    if (!presented) return;
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(presented), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return { login, refresh, logout };
}

export type SessionService = ReturnType<typeof createSessionService>;
