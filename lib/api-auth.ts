import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { ApiScope } from '@/lib/types';
export type { ApiScope };
export { ALL_SCOPES } from '@/lib/types';

export class ApiAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 429,
    public readonly code: string,
    // Seconds until the caller should retry. Only set for 429 (rate limited) errors.
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiAuthError';
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a new API token.
 * Format: mmt_<32 random hex bytes>
 * Returns the full token (shown to user once), its SHA-256 hash, and the 8-char prefix.
 */
export function generateToken(): { token: string; hash: string; prefix: string } {
  const random = randomBytes(32).toString('hex'); // 64 hex chars
  const token = `mmt_${random}`;
  const hash = hashToken(token);
  const prefix = token.slice(0, 12); // "mmt_" + 8 chars
  return { token, hash, prefix };
}

/**
 * Authenticate an API request by its Bearer token.
 * Validates: token exists, not expired, not revoked, has all required scopes.
 * Updates last_used_at asynchronously (non-blocking).
 * Throws ApiAuthError on failure.
 */
export async function requireApiToken(
  request: Request,
  requiredScopes: ApiScope[],
): Promise<{ userId: string; tokenId: string }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiAuthError('Missing or malformed Authorization header', 401, 'invalid_token');
  }

  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) {
    throw new ApiAuthError('Missing token', 401, 'invalid_token');
  }

  const tokenHash = hashToken(rawToken);

  const [row] = await db
    .select()
    .from(schema.apiTokens)
    .where(eq(schema.apiTokens.token_hash, tokenHash))
    .limit(1);

  if (!row) {
    throw new ApiAuthError('Token not found', 401, 'invalid_token');
  }

  if (row.revoked_at) {
    throw new ApiAuthError('Token has been revoked', 401, 'token_revoked');
  }

  if (row.expires_at && row.expires_at < new Date()) {
    throw new ApiAuthError('Token has expired', 401, 'token_expired');
  }

  const tokenScopes: ApiScope[] = Array.isArray(row.scopes) ? (row.scopes as ApiScope[]) : [];
  for (const scope of requiredScopes) {
    if (!tokenScopes.includes(scope)) {
      throw new ApiAuthError(
        `Token missing required scope: ${scope}`,
        403,
        'insufficient_scope',
      );
    }
  }

  // Update last_used_at async — don't block the request
  db.update(schema.apiTokens)
    .set({ last_used_at: new Date() })
    .where(eq(schema.apiTokens.id, row.id))
    .catch((err) => console.error('[api-auth] failed to update last_used_at:', err));

  return { userId: row.user_id, tokenId: row.id };
}
