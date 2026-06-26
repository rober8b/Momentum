import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { requireApiToken, ApiAuthError } from '@/lib/api-auth';
import { enforceApiRateLimit } from '@/lib/api-rate-limit';
import { logAudit } from '@/lib/audit';
import { checkLimit } from '@/lib/limits';
import { isBuildDynamicEngineEnabled } from '@/lib/pillar-flags';
import { BUILD_TEMPLATE } from '@/lib/pillar-templates';
import { ensurePillarForUser, insertPillarItem } from '@/lib/pillar-writes';

export const dynamic = 'force-dynamic';

const buildItemSchema = z.object({
  type: z
    .enum(['hackathon', 'project', 'opinion', 'news', 'portfolio-update', 'open-source', 'demo'])
    .default('project'),
  title: z.string().min(1),
  draft: z.string().optional(),
  hook: z.string().optional(),
  platforms: z.array(z.string()).default(['x', 'linkedin']),
  status: z.enum(['idea', 'draft', 'scheduled', 'published', 'discarded']).default('idea'),
  related_project: z.string().optional(),
  links: z.record(z.string(), z.string()).optional(),
});

const importSchema = z.object({
  items: z.array(buildItemSchema).min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const { userId, tokenId } = await requireApiToken(request, ['build:write']);
    await enforceApiRateLimit(tokenId, 'import/build');

    const body = await request.json().catch(() => null);
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const imported: string[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    const limitCheck = await checkLimit(userId, 'build_items');
    const remaining = limitCheck.limit === null ? Infinity : Math.max(0, limitCheck.limit - limitCheck.current);

    // Phase 6b: when Build is on the dynamic engine, import goes to
    // pillar_items — the legacy build_items table would otherwise become
    // invisible to /build's own UI.
    const pillarId = isBuildDynamicEngineEnabled() ? await ensurePillarForUser(userId, BUILD_TEMPLATE) : null;

    for (let i = 0; i < parsed.data.items.length; i++) {
      if (i >= remaining) {
        errors.push({ index: i, error: `plan limit reached (${limitCheck.limit} build items)` });
        continue;
      }
      const item = parsed.data.items[i];
      try {
        if (pillarId) {
          const id = await insertPillarItem({
            userId,
            pillarId,
            isContainer: false,
            title: item.title,
            status: item.status,
            fields: {
              type: item.type,
              draft: item.draft ?? null,
              hook: item.hook ?? null,
              platforms: item.platforms,
              related_project: item.related_project ?? null,
              links: item.links ?? {},
            },
          });
          imported.push(id);
        } else {
          const [row] = await db
            .insert(schema.buildItems)
            .values({
              user_id: userId,
              type: item.type,
              title: item.title,
              draft: item.draft ?? null,
              hook: item.hook ?? null,
              platforms: item.platforms,
              status: item.status,
              related_project: item.related_project ?? null,
              links: item.links ?? {},
            })
            .returning({ id: schema.buildItems.id });
          if (row) imported.push(row.id);
        }
      } catch (err) {
        errors.push({ index: i, error: err instanceof Error ? err.message : 'unknown error' });
      }
    }

    logAudit({
      userId,
      action: 'api_import_build',
      metadata: { count: imported.length, token_id: tokenId },
    });

    return Response.json({ imported: imported.length, ids: imported, errors });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return Response.json(
        { error: err.message, code: err.code, ...(err.retryAfter ? { retry_after: err.retryAfter } : {}) },
        { status: err.status, headers: err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : undefined },
      );
    }
    console.error('[api/v1/import/build]', err);
    return Response.json({ error: 'Internal server error', code: 'internal_error' }, { status: 500 });
  }
}
