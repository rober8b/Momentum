import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { requireApiToken, ApiAuthError } from '@/lib/api-auth';
import { enforceApiRateLimit } from '@/lib/api-rate-limit';
import { logAudit } from '@/lib/audit';
import { checkLimit } from '@/lib/limits';
import { isProjectsDynamicEngineEnabled } from '@/lib/pillar-flags';
import { PROJECTS_TEMPLATE } from '@/lib/pillar-templates';
import { ensurePillarForUser, insertPillarItem } from '@/lib/pillar-writes';

export const dynamic = 'force-dynamic';

const projectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(['active', 'paused', 'blocked', 'archived']).default('active'),
  icon: z.string().optional(),
  last_update: z.string().optional(),
  next_step: z.string().optional(),
  links: z.record(z.string(), z.string()).optional(),
});

const importSchema = z.object({
  projects: z.array(projectSchema).min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const { userId, tokenId } = await requireApiToken(request, ['projects:write']);
    await enforceApiRateLimit(tokenId, 'import/projects');

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

    const limitCheck = await checkLimit(userId, 'leaf_items');
    const remaining = limitCheck.limit === null ? Infinity : Math.max(0, limitCheck.limit - limitCheck.current);

    // Phase 5b: when Projects is on the dynamic engine, import goes to
    // pillar_items — the legacy own_projects table would otherwise become
    // invisible to /projects' own UI. See docs/DYNAMIC_PILLARS.md.
    const pillarId = isProjectsDynamicEngineEnabled() ? await ensurePillarForUser(userId, PROJECTS_TEMPLATE) : null;

    for (let i = 0; i < parsed.data.projects.length; i++) {
      if (i >= remaining) {
        errors.push({ index: i, error: `plan limit reached (${limitCheck.limit} projects)` });
        continue;
      }
      const p = parsed.data.projects[i];
      try {
        if (pillarId) {
          const id = await insertPillarItem({
            userId,
            pillarId,
            isContainer: false,
            title: p.name,
            description: p.description ?? null,
            status: p.status,
            fields: { icon: p.icon ?? null, last_update: p.last_update ?? null, next_step: p.next_step ?? null, links: p.links ?? {} },
          });
          imported.push(id);
        } else {
          const [row] = await db
            .insert(schema.ownProjects)
            .values({
              user_id: userId,
              name: p.name,
              description: p.description ?? null,
              status: p.status,
              icon: p.icon ?? null,
              last_update: p.last_update ?? null,
              next_step: p.next_step ?? null,
              links: p.links ?? {},
            })
            .returning({ id: schema.ownProjects.id });
          if (row) imported.push(row.id);
        }
      } catch (err) {
        errors.push({ index: i, error: err instanceof Error ? err.message : 'unknown error' });
      }
    }

    logAudit({
      userId,
      action: 'api_import_projects',
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
    console.error('[api/v1/import/projects]', err);
    return Response.json({ error: 'Internal server error', code: 'internal_error' }, { status: 500 });
  }
}
