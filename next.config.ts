import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set the turbopack root to this project's directory
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
