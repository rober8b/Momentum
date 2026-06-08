import type { NextConfig } from "next";

// Startup validation — fail fast if required env vars are missing.
if (process.env.REQUIRE_EMAIL_CONFIRMATION === 'true' && !process.env.EMAIL_FROM) {
  throw new Error(
    'EMAIL_FROM env var is required when REQUIRE_EMAIL_CONFIRMATION is enabled. ' +
    'Set it to an email address from a domain you control (e.g., noreply@yourdomain.com).',
  );
}

// ── Security headers ────────────────────────────────────────────────────────
//
// Applied to all routes. Evaluated server-side; no client JS needed.
//
// CSP notes:
//  - 'unsafe-inline' in script-src is required by Next.js 16 inline script
//    hydration and by the `motion` library (framer-motion successor). Nonces
//    are not yet supported by motion v12's runtime API.
//  - 'unsafe-inline' in style-src is required by Tailwind v4's runtime CSS.
//  - blob: in worker-src is required by some browser internals; safe here
//    because script-src doesn't allow blob:.
//  - data: in img-src allows base64 images used by UI components.
//  - https: in img-src allows external profile pictures / og images.
//
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",    // Next.js hydration + motion v12
  "style-src 'self' 'unsafe-inline'",     // Tailwind v4 runtime
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",              // belt-and-suspenders with X-Frame-Options
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src blob:",
].join('; ');

const SECURITY_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value: CSP,
  },
  {
    // 2-year HSTS with preload — only enable in production behind HTTPS.
    // Comment this out if you're not using HTTPS (local dev).
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIMESTAMP: new Date().toISOString(),
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
