import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
