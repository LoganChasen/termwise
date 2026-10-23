import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-ical and node:sqlite are server-only; keep them out of the bundler.
  serverExternalPackages: ["node-ical"],
};

export default nextConfig;
