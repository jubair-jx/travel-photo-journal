import type { NextConfig } from "next";

// Where the Next.js server forwards /api/* to. The browser only ever talks to its own origin, so
// the API's refresh cookie is same-origin and needs no CORS.
const apiOrigin = process.env["API_INTERNAL_URL"] ?? "http://localhost:4000";

const nextConfig: NextConfig = {
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
