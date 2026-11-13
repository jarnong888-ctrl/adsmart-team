import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Authenticated studio pages are request-specific. Cache Components would
  // force every session read behind a prerender boundary for little gain here.
  cacheComponents: false,
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
