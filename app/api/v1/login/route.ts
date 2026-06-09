import { z } from 'zod';
import { and, eq, gt, lt } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import { db, schema } from '@/lib/db';
import { verifyPassword, signSession, COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function hashIp(ip: string): string {
  const secret = process.env.SESSION_SECRET ?? 'fallback';
  return createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32);
}

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
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
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  db.delete(schema.loginAttempts)
    .where(lt(schema.loginAttempts.attempted_at, cutoff))
    .catch(() => {});
}

export async function POST(request: Request) {
  try {
    const ipHash = hashIp(getClientIp(request));

    const blocked = await checkRateLimit(ipHash);
    if (blocked) {
      return Response.json(
        { error: 'too many attempts — try again in 15 minutes', code: 'rate_limited' },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase().trim()))
      .limit(1);

    const valid = user ? await verifyPassword(password, user.password_hash) : false;

    if (!valid) {
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
      await recordAttempt(ipHash, false);
      return Response.json({ error: 'invalid email or password', code: 'invalid_credentials' }, { status: 401 });
    }

    if (!user.active) {
      return Response.json({ error: 'account disabled', code: 'account_disabled' }, { status: 403 });
    }

    await recordAttempt(ipHash, true);

    db.update(schema.users)
      .set({ last_login_at: new Date() })
      .where(eq(schema.users.id, user.id))
      .catch(() => {});

    logAudit({ userId: user.id, action: 'login' });

    const signed = signSession(user.id);
    const maxAge = SESSION_COOKIE_OPTIONS.maxAge;
    const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString();

    const secure = process.env.NODE_ENV === 'production';
    const cookieHeader = [
      `${COOKIE_NAME}=${signed}`,
      `Path=${SESSION_COOKIE_OPTIONS.path}`,
      `HttpOnly`,
      `SameSite=Lax`,
      `Max-Age=${maxAge}`,
      ...(secure ? ['Secure'] : []),
    ].join('; ');

    return Response.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.display_name,
          role: user.role,
        },
        session_cookie: `${COOKIE_NAME}=${signed}`,
        expires_at: expiresAt,
      },
      {
        status: 200,
        headers: { 'Set-Cookie': cookieHeader },
      },
    );
  } catch (err) {
    console.error('[api/v1/login]', err);
    return Response.json({ error: 'Internal server error', code: 'internal_error' }, { status: 500 });
  }
}
