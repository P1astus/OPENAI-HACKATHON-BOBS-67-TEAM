import type { NextConfig } from "next";

// cacheComponents / partialPrefetching intentionally OFF: API routes read env at request time
// and must never be prerendered at build time.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
