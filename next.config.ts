import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIMESTAMP: new Date().toISOString(),
  },
};

export default nextConfig;
