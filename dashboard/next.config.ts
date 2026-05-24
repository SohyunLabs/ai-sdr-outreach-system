import type { NextConfig } from "next";

// 배포 트리거
const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
