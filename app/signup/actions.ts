'use server';

import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { randomBytes, createHmac } from 'node:crypto';
import { z } from 'zod';
import { and, eq, gt } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { hashPassword, signSession, COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { sendEmailConfirmation } from '@/lib/email';
import { DEFAULT_USER_SETTINGS } from '@/lib/types';

// ── Throwaway email blocklist ──────────────────────────────────────────────
const THROWAWAY_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'guerrillamail.com', 'guerrillamail.net',
  'guerrillamail.org', 'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.info',
  'throwam.com', 'throwaway.email', 'trashmail.com', 'trashmail.at', 'trashmail.io',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'dispostable.com',
  'mailnull.com', 'spamgourmet.com', 'maildrop.cc', 'discard.email', 'fakeinbox.com',
  'spamherelots.com', 'spamhereplease.com', 'spam4.me', 'mailnesia.com',
  'mytemp.email', '10minutemail.com', 'tempinbox.com', 'tempr.email',
]);

function isThrowaway(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? THROWAWAY_DOMAINS.has(domain) : false;
}

// ── Rate limiting (reuse login_attempts with "su:" prefix namespace) ───────
const SIGNUP_WINDOW_MINUTES = 15;
const SIGNUP_MAX_ATTEMPTS = 3;

function hashIp(ip: string): string {
  const secret = process.env.SESSION_SECRET ?? 'fallback';
  return 'su:' + createHmac('sha256', secret).update(ip).digest('hex').slice(0, 30);
}

async function getClientIp(): Promise<string> {
  const hdrs = await headers();
  return (
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    hdrs.get('x-real-ip') ??
    'unknown'
  );
}

async function checkSignupRateLimit(ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - SIGNUP_WINDOW_MINUTES * 60 * 1000);
  const attempts = await db
    .select({ id: schema.loginAttempts.id })
    .from(schema.loginAttempts)
    .where(
      and(
        eq(schema.loginAttempts.ip_hash, ipHash),
        gt(schema.loginAttempts.attempted_at, since),
      ),
    );
  return attempts.length >= SIGNUP_MAX_ATTEMPTS;
}

async function recordSignupAttempt(ipHash: string): Promise<void> {
  await db.insert(schema.loginAttempts).values({ ip_hash: ipHash, success: false });
}

// ── Schema ─────────────────────────────────────────────────────────────────
const signupSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1).max(64),
  password: z.string().min(8),
  timezone: z.string().min(1).default('UTC'),
});

export type SignupState = { error?: string; pendingVerification?: boolean };

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  if (process.env.ALLOW_SIGNUP !== 'true') {
    return { error: 'registro no habilitado' };
  }

  // ── 1. Honeypot check ────────────────────────────────────────────────────
  const honeypot = String(formData.get('website') ?? '');
  if (honeypot) {
    // Bot detected — silent fake success
    return { pendingVerification: true };
  }

  // ── 2. Rate limit ────────────────────────────────────────────────────────
  const ipHash = hashIp(await getClientIp());
  const blocked = await checkSignupRateLimit(ipHash);
  if (blocked) {
    return { error: 'demasiados registros desde tu IP — intentá en 15 minutos' };
  }

  // ── 3. Parse + validate ──────────────────────────────────────────────────
  const raw = {
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    display_name: String(formData.get('display_name') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
    timezone: String(formData.get('timezone') ?? 'UTC'),
  };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'datos inválidos' };
  }

  // ── 4. Throwaway email ───────────────────────────────────────────────────
  if (isThrowaway(parsed.data.email)) {
    return { error: 'ese dominio de email no está permitido' };
  }

  // ── 5. Duplicate email ───────────────────────────────────────────────────
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.email))
    .limit(1);

  if (existing) {
    return { error: 'ese email ya está registrado' };
  }

  // ── 6. Record attempt (after validations to avoid counting invalid input) ─
  await recordSignupAttempt(ipHash);

  // ── 7. Create user ───────────────────────────────────────────────────────
  const requireConfirmation = process.env.REQUIRE_EMAIL_CONFIRMATION === 'true';
  const password_hash = await hashPassword(parsed.data.password);
  const settings = { ...DEFAULT_USER_SETTINGS, timezone: parsed.data.timezone };

  const [user] = await db
    .insert(schema.users)
    .values({
      email: parsed.data.email,
      display_name: parsed.data.display_name,
      password_hash,
      role: 'member',
      active: !requireConfirmation,
      settings,
    })
    .returning({ id: schema.users.id });

  if (!user) return { error: 'error creando cuenta' };

  logAudit({ userId: user.id, action: 'signup' });

  // ── 8. Email confirmation (if required) ──────────────────────────────────
  if (requireConfirmation) {
    const rawToken = randomBytes(32).toString('hex');
    const { createHash } = await import('node:crypto');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await db.insert(schema.passwordResetTokens).values({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    await sendEmailConfirmation({
      to: parsed.data.email,
      confirmLink: `${base}/verify-email/${rawToken}`,
      displayName: parsed.data.display_name,
    });

    return { pendingVerification: true };
  }

  // ── 9. Auto-login (no confirmation required) ─────────────────────────────
  const store = await cookies();
  store.set(COOKIE_NAME, signSession(user.id), {
    ...SESSION_COOKIE_OPTIONS,
    secure: process.env.NODE_ENV === 'production',
  });

  redirect('/');
}
