'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, gt, lt } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import { COOKIE_NAME, signSession, verifyPassword, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { db, schema } from '@/lib/db';

export type LoginState = { error?: string };

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;

function hashIp(ip: string): string {
  const secret = process.env.SESSION_SECRET ?? 'fallback';
  return createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32);
}

async function getClientIp(headers: Headers): Promise<string> {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  );
}

async function checkRateLimit(ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const attempts = await db
    .select()
    .from(schema.loginAttempts)
    .where(
      and(
        eq(schema.loginAttempts.ip_hash, ipHash),
        eq(schema.loginAttempts.success, false),
        gt(schema.loginAttempts.attempted_at, since),
      ),
    );
  return attempts.length >= MAX_ATTEMPTS;
}

async function recordAttempt(ipHash: string, success: boolean): Promise<void> {
  await db.insert(schema.loginAttempts).values({ ip_hash: ipHash, success });
  // Clean up old attempts (> 1 hour) to keep table small
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  db.delete(schema.loginAttempts)
    .where(lt(schema.loginAttempts.attempted_at, cutoff))
    .catch(() => {});
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const { headers } = await import('next/headers');
  const hdrs = await headers();
  const ipHash = hashIp(await getClientIp(hdrs));

  // Rate limit check
  const blocked = await checkRateLimit(ipHash);
  if (blocked) {
    return { error: 'too many attempts — try again in 15 minutes' };
  }

  const email = String(formData.get('email') ?? '').toLowerCase().trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/');

  if (!email || !password) {
    return { error: 'email and password required' };
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  const valid = user ? await verifyPassword(password, user.password_hash) : false;

  if (!valid) {
    // Timing-safe delay to slow brute force
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
    await recordAttempt(ipHash, false);
    return { error: 'invalid email or password' };
  }

  if (!user.active) {
    return { error: 'account disabled' };
  }

  await recordAttempt(ipHash, true);

  // Update last_login_at
  await db.update(schema.users).set({ last_login_at: new Date() }).where(eq(schema.users.id, user.id));

  logAudit({ userId: user.id, action: 'login' });

  const store = await cookies();
  store.set(COOKIE_NAME, signSession(user.id), {
    ...SESSION_COOKIE_OPTIONS,
    secure: process.env.NODE_ENV === 'production',
  });

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  redirect(safeNext);
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  redirect('/login');
}
