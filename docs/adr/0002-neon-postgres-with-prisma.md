# Neon Postgres with Prisma

Data lives in Neon-hosted Postgres, accessed only through Prisma. Photos belong to users, tokens expire and chain, and verification tokens must be single-use: that is relational data needing ownership foreign keys, unique constraints, cascading deletes and transactions, which a document store would leave to application code. Prisma gives typed queries and migrations and keeps raw SQL out of the codebase.

Two connection strings are used. `DATABASE_URL` is the pooled endpoint for the running app (safe connection counts on small instances). `DIRECT_URL` is the direct endpoint used only for migrations, because pooled connections do not support everything migrations need. Prisma 7 takes datasource URLs from `prisma.config.ts` rather than the schema file and requires a driver adapter at runtime.

Considered: MongoDB (weaker relational guarantees), Supabase (bundles auth and storage that this project implements deliberately), Drizzle (less mature migration tooling).
