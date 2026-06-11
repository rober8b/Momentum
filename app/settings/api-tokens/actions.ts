'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { generateToken } from '@/lib/api-auth';
import { checkLimit, type LimitReachedError } from '@/lib/limits';
import { ALL_SCOPES } from '@/lib/types';
import type { ApiScope } from '@/lib/types';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(ALL_SCOPES as [ApiScope, ...ApiScope[]])).min(1),
  expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
});

/**
 * Generate a new API token.
 * Returns the full token string — this is the ONLY time it will be visible.
 */
export async function createApiToken(
  input: z.infer<typeof createSchema>,
): Promise<LimitReachedError | { tokenId: string; fullToken: string }> {
  const user = await requireUser();
  const limitCheck = await checkLimit(user.id, 'api_tokens');
  if (!limitCheck.allowed) {
    return { error: 'limit_reached', resource: 'api_tokens', limit: limitCheck.limit! };
  }
  const parsed = createSchema.parse(input);

  const { token, hash, prefix } = generateToken();

  const [row] = await db
    .insert(schema.apiTokens)
    .values({
      user_id: user.id,
      name: parsed.name,
      token_hash: hash,
      token_prefix: prefix,
      scopes: parsed.scopes,
      expires_at: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
    })
    .returning({ id: schema.apiTokens.id });

  if (!row) throw new Error('Failed to create token');

  logAudit({
    userId: user.id,
    action: 'api_token_created',
    entityType: 'api_token',
    entityId: row.id,
    metadata: { name: parsed.name, scopes: parsed.scopes },
  });

  revalidatePath('/settings/api-tokens');
  return { tokenId: row.id, fullToken: token };
}

/**
 * Revoke a token by setting revoked_at = now().
 */
export async function revokeApiToken(tokenId: string): Promise<void> {
  const user = await requireUser();

  const [row] = await db
    .update(schema.apiTokens)
    .set({ revoked_at: new Date() })
    .where(
      and(eq(schema.apiTokens.id, tokenId), eq(schema.apiTokens.user_id, user.id)),
    )
    .returning({ id: schema.apiTokens.id });

  if (!row) throw new Error('Token not found');

  logAudit({
    userId: user.id,
    action: 'api_token_revoked',
    entityType: 'api_token',
    entityId: row.id,
  });

  revalidatePath('/settings/api-tokens');
}
