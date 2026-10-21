import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth cookies use 127.0.0.1; allow that hostname for Next's dev endpoints too.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      // Process the Tailwind entry without changing native CSS Modules.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
