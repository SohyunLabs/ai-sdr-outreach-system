import type { NextConfig } from "next";

// deployment trigger
const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
