import type { NextConfig } from "next";

// Startup validation — fail fast if required env vars are missing.
if (process.env.REQUIRE_EMAIL_CONFIRMATION === 'true' && !process.env.EMAIL_FROM) {
  throw new Error(
    'EMAIL_FROM env var is required when REQUIRE_EMAIL_CONFIRMATION is enabled. ' +
    'Set it to an email address from a domain you control (e.g., noreply@yourdomain.com).',
  );
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIMESTAMP: new Date().toISOString(),
  },
};

export default nextConfig;
