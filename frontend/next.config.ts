import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Where the Next.js server forwards /api/* to. The browser only ever talks to its own origin, so
// the API's refresh cookie is same-origin and needs no CORS. Rewrites are resolved at build time,
// so for a container image this is a build argument, not a runtime variable.
const apiOrigin = process.env["API_INTERNAL_URL"] ?? "http://localhost:4000";

// The Docker image uses Next's "standalone" output (a self-contained server plus only the files it
// needs). Other targets, such as Vercel, build the default output.
const standalone = process.env["NEXT_OUTPUT"] === "standalone";

const nextConfig: NextConfig = {
  ...(standalone && {
    output: "standalone" as const,
    // In a monorepo, dependencies live at the repository root; tracing must start there.
    outputFileTracingRoot: fileURLToPath(new URL("../", import.meta.url)),
  }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  rewrites() {
    return Promise.resolve([{ source: "/api/:path*", destination: `${apiOrigin}/:path*` }]);
  },
};

export default nextConfig;
