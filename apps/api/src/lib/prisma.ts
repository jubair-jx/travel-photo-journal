import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export { PrismaClient };
export type { Photo } from "../generated/prisma/client.js";

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

// Prisma reports database failures as errors carrying a code such as "P2002".
const hasCode = (error: unknown, code: string): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === code;

// P2002: a unique constraint was violated.
export const isUniqueViolation = (error: unknown): boolean => hasCode(error, "P2002");

// P2025: the record to update or delete does not exist.
export const isRecordNotFound = (error: unknown): boolean => hasCode(error, "P2025");
