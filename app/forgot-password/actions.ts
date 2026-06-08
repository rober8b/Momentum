'use server';

import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';

const schema_ = z.object({
  email: z.string().email(),
});

export type ForgotState = { done?: boolean; error?: string };

export async function forgotPasswordAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const raw = { email: String(formData.get('email') ?? '').toLowerCase().trim() };
  const parsed = schema_.safeParse(raw);
  if (!parsed.success) return { error: 'email inválido' };

  const { email } = parsed.data;

  // Always return success to avoid user enumeration
  const [user] = await db
    .select({ id: schema.users.id, display_name: schema.users.display_name })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (user) {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate previous tokens for this user
    await db
      .delete(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.user_id, user.id));

    await db.insert(schema.passwordResetTokens).values({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const resetLink = `${base}/reset-password/${rawToken}`;

    await sendPasswordResetEmail({
      to: email,
      resetLink,
      displayName: user.display_name,
    });
  }

  return { done: true };
}
