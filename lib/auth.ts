// Multi-user auth — bcrypt password hash + HMAC-signed cookie.
// Cookie format: {userId}.{iat}.{hmac(userId.iat)}
// - userId: user UUID
// - iat: issued-at unix timestamp (seconds) — enables per-user session invalidation
// - hmac: SHA-256 over "userId.iat" using SESSION_SECRET
//
// requireUser() is the second layer of defense; proxy.ts (Edge) handles the redirect.

import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { User, UserSettings } from '@/lib/types';
import { DEFAULT_USER_SETTINGS } from '@/lib/types';

export const COOKIE_NAME = 'momentum_session';
const MAX_AGE_DAYS = 30;
export const BCRYPT_ROUNDS = 12;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET not configured (minimum 16 chars)');
  }
  return s;
}

function hmacBase64Url(value: string): string {
  return createHmac('sha256', getSecret()).update(value).digest('base64url');
}

// Cookie: "{userId}.{iat}.{hmac(userId.iat)}"
export function signSession(userId: string): string {
  const iat = Math.floor(Date.now() / 1000).toString();
  const payload = `${userId}.${iat}`;
  return `${payload}.${hmacBase64Url(payload)}`;
}

// Returns { userId, iat } if the HMAC is valid, null otherwise.
export function verifySession(signed: string | undefined): { userId: string; iat: number } | null {
  if (!signed) return null;
  const lastDot = signed.lastIndexOf('.');
  if (lastDot < 0) return null;
  const payload = signed.slice(0, lastDot);
  const sig = signed.slice(lastDot + 1);
  // payload must be "uuid.timestamp" — two segments separated by a dot
  const firstDot = payload.indexOf('.');
  if (firstDot < 0) return null;
  const userId = payload.slice(0, firstDot);
  const iatStr = payload.slice(firstDot + 1);
  if (!userId || !iatStr || !/^\d+$/.test(iatStr)) return null;

  let expected: string;
  try {
    expected = hmacBase64Url(payload);
  } catch {
    return null;
  }
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return { userId, iat: parseInt(iatStr, 10) };
}

function rowToUser(row: typeof schema.users.$inferSelect): User {
  const settings: UserSettings = { ...DEFAULT_USER_SETTINGS, ...(row.settings as Partial<UserSettings>) };
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: row.role,
    active: row.active,
    plan: row.plan,
    plan_status: row.plan_status,
    settings,
    invalidate_sessions_before: row.invalidate_sessions_before ?? null,
    created_at: row.created_at.toISOString(),
    last_login_at: row.last_login_at ? row.last_login_at.toISOString() : null,
  };
}

/**
 * Verify the session cookie and return the current user.
 * Throws 'NOT_SIGNED_IN' if the cookie is missing, invalid, or the user is inactive.
 * Call this at the top of every protected Server Component and Server Action.
 */
export async function requireUser(): Promise<User> {
  const store = await cookies();
  const signed = store.get(COOKIE_NAME)?.value;
  const session = verifySession(signed);
  if (!session) throw new Error('NOT_SIGNED_IN');

  const [row] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);

  if (!row || !row.active) throw new Error('NOT_SIGNED_IN');

  // Check per-user session invalidation timestamp
  if (row.invalidate_sessions_before && session.iat < row.invalidate_sessions_before) {
    throw new Error('NOT_SIGNED_IN');
  }

  return rowToUser(row);
}

/**
 * Like requireUser() but additionally requires role === 'admin'.
 *
 * Layered defense for the /admin segment:
 *  - proxy.ts (Edge) already guarantees a valid session cookie before any /admin/*
 *    handler runs, but the cookie carries only the userId+HMAC — NOT the role — so
 *    role gating cannot happen at the Edge without a DB round-trip. It is enforced
 *    here, in the Node layer, instead.
 *  - Call this at the top of the /admin layout, every /admin page, and every admin
 *    server action. A non-admin (member) is redirected to '/' and never sees admin
 *    content or is able to invoke an admin mutation.
 *
 * Throws 'NOT_SIGNED_IN' (via requireUser) if unauthenticated; redirects to '/' if
 * authenticated but not an admin.
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'admin') {
    redirect('/');
  }
  return user;
}

/**
 * Like requireUser() but returns null instead of throwing.
 * Use in pages that have both a public and authenticated view (e.g. landing vs dashboard).
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

/** Hash a plaintext password. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Timing-safe password verification. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * MAX_AGE_DAYS,
};

/**
 * Create a session for the given user: signs the session token and sets the
 * `momentum_session` cookie. Returns the signed token (used by API routes that
 * also need to echo it in the response body).
 */
export async function createSession(userId: string): Promise<string> {
  const signed = signSession(userId);
  const store = await cookies();
  store.set(COOKIE_NAME, signed, {
    ...SESSION_COOKIE_OPTIONS,
    secure: process.env.NODE_ENV === 'production',
  });
  return signed;
}
