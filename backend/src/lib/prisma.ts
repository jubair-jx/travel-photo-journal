import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export { PrismaClient };
export type { Photo } from "../generated/prisma/client.js";

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    // Without a connect timeout a stalled connection would hang the request until the platform
    // gives up; with one it fails fast and the caller gets a retryable 503.
    adapter: new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 20_000 }),
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

// Connection, pool and transaction-start failures: P1001/P1002 unreachable or timed out, P1008
// operation timeout, P1017 server closed the connection, P2024 pool timeout, P2028 transaction API.
const TRANSIENT_CODES = ["P1001", "P1002", "P1008", "P1017", "P2024", "P2028"];

export const isDatabaseUnavailable = (error: unknown): boolean =>
  (typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "PrismaClientInitializationError") ||
  TRANSIENT_CODES.some((code) => hasCode(error, code));
