'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import type { OAuthProvider } from '@/lib/types';

const profileSchema = z.object({
  display_name: z.string().min(1).max(100),
  settings: z.object({
    timezone: z.string().min(1),
    language: z.enum(['en', 'es']),
    vault_path: z.string(),
    export_enabled: z.boolean(),
  }),
});

export async function updateUserProfile(input: unknown) {
  const user = await requireUser();
  const parsed = profileSchema.parse(input);

  await db
    .update(schema.users)
    .set({
      display_name: parsed.display_name,
      settings: {
        ...user.settings,
        timezone: parsed.settings.timezone,
        language: parsed.settings.language,
        vault_path: parsed.settings.vault_path,
        export_enabled: parsed.settings.export_enabled,
      },
    })
    .where(eq(schema.users.id, user.id));

  logAudit({ userId: user.id, action: 'settings_updated' });
  revalidatePath('/settings/profile');
}

const unlinkSchema = z.object({
  provider: z.enum(['github', 'google']),
});

/**
 * Unlink an OAuth account. Refuses if it's the user's only login method
 * (no password set and no other OAuth account linked).
 */
export async function unlinkOAuthAccount(input: { provider: OAuthProvider }): Promise<{ error?: 'last_method' }> {
  const user = await requireUser();
  const { provider } = unlinkSchema.parse(input);

  const [userRow] = await db
    .select({ password_hash: schema.users.password_hash })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  const accounts = await db
    .select({ provider: schema.oauthAccounts.provider })
    .from(schema.oauthAccounts)
    .where(eq(schema.oauthAccounts.user_id, user.id));

  const hasPassword = !!userRow?.password_hash;
  if (!hasPassword && accounts.length <= 1) {
    return { error: 'last_method' };
  }

  await db
    .delete(schema.oauthAccounts)
    .where(and(eq(schema.oauthAccounts.user_id, user.id), eq(schema.oauthAccounts.provider, provider)));

  logAudit({ userId: user.id, action: 'oauth_account_unlinked', metadata: { provider } });
  revalidatePath('/settings/profile');
  return {};
}
