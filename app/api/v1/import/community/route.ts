import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireApiToken, ApiAuthError } from '@/lib/api-auth';
import { enforceApiRateLimit } from '@/lib/api-rate-limit';
import { logAudit } from '@/lib/audit';
import { checkLimit } from '@/lib/limits';
import { isCommunityDynamicEngineEnabled } from '@/lib/pillar-flags';
import { COMMUNITY_TEMPLATE } from '@/lib/pillar-templates';
import { ensurePillarForUser, findOrCreateContainerItem, insertPillarItem } from '@/lib/pillar-writes';

export const dynamic = 'force-dynamic';

const itemSchema = z.object({
  organization_name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['pending', 'done', 'cancelled']).default('pending'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

const importSchema = z.object({
  items: z.array(itemSchema).min(1).max(200),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 80);
}

export async function POST(request: Request) {
  try {
    const { userId, tokenId } = await requireApiToken(request, ['community:write', 'organizations:write']);
    await enforceApiRateLimit(tokenId, 'import/community');

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
    const orgCache = new Map<string, string>(); // name -> id

    const limitCheck = await checkLimit(userId, 'community_items');
    const remaining = limitCheck.limit === null ? Infinity : Math.max(0, limitCheck.limit - limitCheck.current);

    // Phase 5b: when Community is on the dynamic engine, import goes to
    // pillar_items — the legacy organizations/community_items tables would
    // otherwise become invisible to /community's own UI. Organizations are
    // deduped by name only, same as the legacy orgCache behavior.
    const pillarId = isCommunityDynamicEngineEnabled() ? await ensurePillarForUser(userId, COMMUNITY_TEMPLATE) : null;
    const containerStatus = COMMUNITY_TEMPLATE.status_workflow[0].key;

    for (let i = 0; i < parsed.data.items.length; i++) {
      if (i >= remaining) {
        errors.push({ index: i, error: `plan limit reached (${limitCheck.limit} community items)` });
        continue;
      }
      const item = parsed.data.items[i];
      try {
        if (pillarId) {
          let orgId = orgCache.get(item.organization_name);
          if (!orgId) {
            orgId = await findOrCreateContainerItem(userId, pillarId, item.organization_name, {
              status: containerStatus,
              fields: { slug: slugify(item.organization_name) },
            });
            orgCache.set(item.organization_name, orgId);
          }

          const id = await insertPillarItem({
            userId,
            pillarId,
            parentItemId: orgId,
            isContainer: false,
            title: item.title,
            description: item.description ?? null,
            status: item.status,
            dueDate: item.due_date ?? null,
          });
          imported.push(id);
        } else {
          let orgId = orgCache.get(item.organization_name);
          if (!orgId) {
            const [existing] = await db
              .select({ id: schema.organizations.id })
              .from(schema.organizations)
              .where(
                and(
                  eq(schema.organizations.user_id, userId),
                  eq(schema.organizations.name, item.organization_name),
                ),
              )
              .limit(1);

            if (existing) {
              orgId = existing.id;
            } else {
              const [created] = await db
                .insert(schema.organizations)
                .values({
                  user_id: userId,
                  name: item.organization_name,
                  slug: slugify(item.organization_name),
                })
                .returning({ id: schema.organizations.id });
              orgId = created!.id;
            }
            orgCache.set(item.organization_name, orgId);
          }

          const [row] = await db
            .insert(schema.communityItems)
            .values({
              user_id: userId,
              organization_id: orgId,
              title: item.title,
              description: item.description ?? null,
              status: item.status,
              due_date: item.due_date ?? null,
            })
            .returning({ id: schema.communityItems.id });

          if (row) imported.push(row.id);
        }
      } catch (err) {
        errors.push({ index: i, error: err instanceof Error ? err.message : 'unknown error' });
      }
    }

    logAudit({
      userId,
      action: 'api_import_community',
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
    console.error('[api/v1/import/community]', err);
    return Response.json({ error: 'Internal server error', code: 'internal_error' }, { status: 500 });
  }
}
