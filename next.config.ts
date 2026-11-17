import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the output-file-tracing root to the build cwd: keeps standalone
  // output at .next/standalone/ even when a parent directory has its own
  // lockfile (otherwise Next nests it under .next/standalone/<rel-path>/).
  outputFileTracingRoot: path.resolve(),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // socket.io engines run in-process (see src/instrumentation.ts /
  // src/lib/engine-host.ts) — keep them external to the bundle.
  serverExternalPackages: ["socket.io", "bufferutil", "utf-8-validate"],
};

export default nextConfig;
