import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set the turbopack root to this project's directory
  turbopack: {
    root: __dirname,
  },
  
  // Increase body size limit for Server Actions (canvas images can be large)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
