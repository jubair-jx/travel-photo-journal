import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Migrations use the direct (non-pooled) connection. `prisma generate` needs no database,
    // so a missing value must not break it.
    url: process.env["DIRECT_URL"] ?? "",
  },
});
