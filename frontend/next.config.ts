import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal, self-contained server in .next/standalone —
  // only the files actually needed at runtime, instead of the full
  // node_modules tree. This is what keeps the final Docker image small
  // and avoids needing `npm install` inside the runtime stage at all.
  output: "standalone",
};

export default nextConfig;