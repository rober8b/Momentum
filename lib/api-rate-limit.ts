import 'server-only';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { ApiAuthError } from '@/lib/api-auth';
import { isHostedMode } from '@/lib/limits';
import { API_IMPORT_RATE_LIMIT } from '@/lib/rate-limits';

/**
 * Enforce a sliding-window, per-token rate limit on API v1 import endpoints.
 * Call after requireApiToken() succeeds, passing the resolved tokenId and a
 * route label (used only for the stored hit, not for the limit itself — the
 * budget is shared across all import endpoints per token, since they all hit
 * the same DB and a token spreading requests across endpoints shouldn't get a
 * bigger combined budget than one hammering a single endpoint).
 *
 * Throws ApiAuthError(429) when the limit is exceeded.
 */
export async function enforceApiRateLimit(tokenId: string, route: string): Promise<void> {
  const { windowMinutes, maxRequests } = isHostedMode()
    ? API_IMPORT_RATE_LIMIT.hosted
    : API_IMPORT_RATE_LIMIT.self_hosted;

  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const hits = await db
    .select({ created_at: schema.apiRateLimitHits.created_at })
    .from(schema.apiRateLimitHits)
    .where(and(eq(schema.apiRateLimitHits.token_id, tokenId), gt(schema.apiRateLimitHits.created_at, since)))
    .orderBy(schema.apiRateLimitHits.created_at);

  if (hits.length >= maxRequests) {
    const oldest = hits[0].created_at;
    const retryAfter = Math.max(1, Math.ceil((oldest.getTime() + windowMinutes * 60 * 1000 - Date.now()) / 1000));
    throw new ApiAuthError(
      `Rate limit exceeded: max ${maxRequests} requests per ${windowMinutes} minute(s) on import endpoints`,
      429,
      'rate_limited',
      retryAfter,
    );
  }

  await db.insert(schema.apiRateLimitHits).values({ token_id: tokenId, route });

  // Opportunistic cleanup of old rows, mirrors login_attempts cleanup in app/login/actions.ts.
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  db.delete(schema.apiRateLimitHits)
    .where(lt(schema.apiRateLimitHits.created_at, cutoff))
    .catch((err) => console.error('[api-rate-limit] cleanup failed:', err));
}
