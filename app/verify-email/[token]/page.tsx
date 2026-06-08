import { notFound, redirect } from 'next/navigation';
import { createHash } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db, schema } from '@/lib/db';
import { signSession, COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = new Date();

  const [row] = await db
    .select()
    .from(schema.passwordResetTokens)
    .where(
      and(
        eq(schema.passwordResetTokens.token_hash, tokenHash),
        isNull(schema.passwordResetTokens.used_at),
        gt(schema.passwordResetTokens.expires_at, now),
      ),
    )
    .limit(1);

  if (!row) notFound();

  // Check the user exists and is inactive (awaiting email confirmation)
  const [user] = await db
    .select({ id: schema.users.id, active: schema.users.active })
    .from(schema.users)
    .where(eq(schema.users.id, row.user_id))
    .limit(1);

  if (!user) notFound();

  // Activate user + mark token used
  await Promise.all([
    db.update(schema.users).set({ active: true }).where(eq(schema.users.id, user.id)),
    db
      .update(schema.passwordResetTokens)
      .set({ used_at: now })
      .where(eq(schema.passwordResetTokens.id, row.id)),
  ]);

  logAudit({ userId: user.id, action: 'update', entityType: 'email_verified' });

  // Auto-login
  const store = await cookies();
  store.set(COOKIE_NAME, signSession(user.id), {
    ...SESSION_COOKIE_OPTIONS,
    secure: process.env.NODE_ENV === 'production',
  });

  redirect('/');
}
