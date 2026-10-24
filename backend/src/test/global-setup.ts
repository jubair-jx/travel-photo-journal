import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { testDatabaseUrl } from "./db.js";

// Brings the test database to the latest migration once, before any test file runs.
export default function setup(): void {
  const require = createRequire(import.meta.url);
  const prismaCli = join(dirname(require.resolve("prisma/package.json")), "build", "index.js");

  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    env: { ...process.env, DIRECT_URL: testDatabaseUrl },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      `Could not migrate the test database (is it running? try "docker compose up -d postgres").\n${result.stderr}`,
    );
  }
}
