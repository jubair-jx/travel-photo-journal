import { hashPassword } from "../lib/crypto.js";
import type { PrismaClient } from "../lib/prisma.js";

export interface NewUser {
  email?: string;
  password?: string;
  verified?: boolean;
}

export const defaultUser = { email: "traveller@example.com", password: "a-long-password" };

// Inserts directly, so session tests do not depend on the registration flow.
export async function createUser(prisma: PrismaClient, user: NewUser = {}) {
  const { email = defaultUser.email, password = defaultUser.password, verified = true } = user;
  return prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      emailVerifiedAt: verified ? new Date() : null,
    },
  });
}
