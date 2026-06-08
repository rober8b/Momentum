'use server';

import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { hashPassword, signSession, COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const schema_ = z.object({
  password: z.string().min(8),
  token: z.string().min(1),
});

export type ResetState = { error?: string };

export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const raw = {
    password: String(formData.get('password') ?? ''),
    token: String(formData.get('token') ?? ''),
  };

  const parsed = schema_.safeParse(raw);
  if (!parsed.success) return { error: 'datos inválidos' };

  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
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

  if (!row) {
    return { error: 'el link expiró o ya fue usado' };
  }

  const password_hash = await hashPassword(parsed.data.password);

  // Update password + mark token used + invalidate old sessions (all in parallel)
  const invalidate_sessions_before = Math.floor(Date.now() / 1000);
  await Promise.all([
    db
      .update(schema.users)
      .set({ password_hash, invalidate_sessions_before })
      .where(eq(schema.users.id, row.user_id)),
    db
      .update(schema.passwordResetTokens)
      .set({ used_at: now })
      .where(eq(schema.passwordResetTokens.id, row.id)),
  ]);

  logAudit({ userId: row.user_id, action: 'update', entityType: 'password' });

  // Auto-login after successful reset
  const store = await cookies();
  store.set(COOKIE_NAME, signSession(row.user_id), {
    ...SESSION_COOKIE_OPTIONS,
    secure: process.env.NODE_ENV === 'production',
  });

  redirect('/');
}
