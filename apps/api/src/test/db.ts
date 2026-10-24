import { createPrismaClient, type PrismaClient } from "../lib/prisma.js";

// Defaults to the database created by docker-compose, so no .env is needed to run the tests.
export const testDatabaseUrl =
  process.env["DATABASE_URL_TEST"] ?? "postgresql://tpj:tpj@localhost:5432/tpj_test";

export function createTestPrisma(): PrismaClient {
  return createPrismaClient(testDatabaseUrl);
}

// Children first: foreign keys would reject deleting a user that still owns rows.
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.photo.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.user.deleteMany();
}
