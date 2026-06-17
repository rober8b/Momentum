// Polar (Merchant of Record) client — billing only applies in MOMENTUM_MODE='hosted'.
// A self-host install can leave all POLAR_* env vars unset: isPolarConfigured()
// returns false and every billing action/UI no-ops or hides cleanly.

import 'server-only';
import { Polar } from '@polar-sh/sdk';

/** True only when the env vars needed to talk to Polar are present. */
export function isPolarConfigured(): boolean {
  return !!(process.env.POLAR_ACCESS_TOKEN && process.env.POLAR_PRO_PRODUCT_ID);
}

let client: Polar | null = null;

/** Lazily-initialized Polar SDK client. Only call when `isPolarConfigured()` is true. */
export function getPolarClient(): Polar {
  if (!client) {
    client = new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      server: process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox',
    });
  }
  return client;
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}
