import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // finprint-host runs `.next/standalone/server.js` directly; see deploy/windows.
  output: "standalone",
};

export default nextConfig;
