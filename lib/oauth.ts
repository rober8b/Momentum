// OAuth 2.0 authorization-code flow (manual implementation, no third-party lib).
// Supports GitHub and Google as login/signup methods alongside email/password.
// A provider is considered "configured" only when both its client id and
// secret env vars are set — callers must check this before rendering buttons
// or initiating the flow (self-host users may not configure OAuth at all).

import 'server-only';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { OAuthProvider } from '@/lib/types';

const STATE_COOKIE_MAX_AGE = 60 * 10; // 10 minutes

export type OAuthProviderConfig = {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
};

export type OAuthProfile = {
  providerAccountId: string;
  email: string | null;
  name: string | null;
};

export type OAuthState = {
  state: string;
  next: string;
};

export class OAuthError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === 'github' || value === 'google';
}

function getRedirectBaseUrl(): string {
  const base = process.env.OAUTH_REDIRECT_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return base.replace(/\/$/, '');
}

export function getOAuthRedirectUri(provider: OAuthProvider): string {
  return `${getRedirectBaseUrl()}/api/auth/${provider}/callback`;
}

/** Returns null if the provider's env vars are not configured. */
export function getOAuthConfig(provider: OAuthProvider): OAuthProviderConfig | null {
  if (provider === 'github') {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      clientId,
      clientSecret,
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scope: 'read:user user:email',
    };
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  };
}

export function isProviderConfigured(provider: OAuthProvider): boolean {
  return getOAuthConfig(provider) !== null;
}

export function buildAuthorizeUrl(provider: OAuthProvider, config: OAuthProviderConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: getOAuthRedirectUri(provider),
    scope: config.scope,
    state,
    response_type: 'code',
  });
  if (provider === 'google') {
    params.set('access_type', 'online');
    params.set('prompt', 'select_account');
  }
  return `${config.authorizeUrl}?${params.toString()}`;
}

export function generateState(): string {
  return randomBytes(32).toString('hex');
}

export function statesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function oauthStateCookieName(provider: OAuthProvider): string {
  return `momentum_oauth_state_${provider}`;
}

/** Stores the CSRF state token + post-login redirect path in a short-lived signed-by-httpOnly cookie. */
export async function setOAuthStateCookie(provider: OAuthProvider, state: string, next: string): Promise<void> {
  const store = await cookies();
  store.set(oauthStateCookieName(provider), JSON.stringify({ state, next }), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });
}

/** Reads and deletes the state cookie. Returns null if missing or malformed. */
export async function consumeOAuthStateCookie(provider: OAuthProvider): Promise<OAuthState | null> {
  const store = await cookies();
  const raw = store.get(oauthStateCookieName(provider))?.value;
  store.delete(oauthStateCookieName(provider));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OAuthState>;
    if (typeof parsed.state !== 'string' || typeof parsed.next !== 'string') return null;
    return { state: parsed.state, next: parsed.next };
  } catch {
    return null;
  }
}

export async function exchangeCodeForToken(provider: OAuthProvider, config: OAuthProviderConfig, code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: getOAuthRedirectUri(provider),
    grant_type: 'authorization_code',
  });

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  if (!res.ok) throw new OAuthError(`token exchange failed (${res.status})`, 'oauth_exchange_failed');

  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new OAuthError(data.error_description ?? data.error ?? 'no access token returned', 'oauth_exchange_failed');
  }
  return data.access_token;
}

async function fetchGithubProfile(accessToken: string): Promise<OAuthProfile> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'momentum-app',
  };

  const userRes = await fetch('https://api.github.com/user', { headers });
  if (!userRes.ok) throw new OAuthError(`failed to fetch GitHub profile (${userRes.status})`, 'oauth_profile_failed');
  const user = (await userRes.json()) as { id: number; login: string; name?: string | null; email?: string | null };

  let email = user.email ?? null;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', { headers });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
      email = emails.find((e) => e.primary && e.verified)?.email ?? emails.find((e) => e.verified)?.email ?? null;
    }
  }

  return {
    providerAccountId: String(user.id),
    email: email ? email.toLowerCase() : null,
    name: user.name ?? user.login,
  };
}

async function fetchGoogleProfile(accessToken: string): Promise<OAuthProfile> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new OAuthError(`failed to fetch Google profile (${res.status})`, 'oauth_profile_failed');
  const data = (await res.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string };

  return {
    providerAccountId: data.sub,
    email: data.email_verified && data.email ? data.email.toLowerCase() : null,
    name: data.name ?? null,
  };
}

export async function fetchOAuthProfile(provider: OAuthProvider, accessToken: string): Promise<OAuthProfile> {
  return provider === 'github' ? fetchGithubProfile(accessToken) : fetchGoogleProfile(accessToken);
}
