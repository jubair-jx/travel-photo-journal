import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export { PrismaClient };
export type { Photo } from "../generated/prisma/client.js";

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
    // The defaults (2 s to start a transaction, 5 s to run it) are too tight for a serverless
    // database: a cold compute or a distant region makes a first connection take seconds, which
    // surfaced as 500s on refresh. Waiting longer costs nothing when the database is quick.
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  });
}

// Prisma reports database failures as errors carrying a code such as "P2002".
const hasCode = (error: unknown, code: string): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === code;

// P2002: a unique constraint was violated.
export const isUniqueViolation = (error: unknown): boolean => hasCode(error, "P2002");

// P2025: the record to update or delete does not exist.
export const isRecordNotFound = (error: unknown): boolean => hasCode(error, "P2025");
