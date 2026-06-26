import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { requireApiToken, ApiAuthError } from '@/lib/api-auth';
import { enforceApiRateLimit } from '@/lib/api-rate-limit';
import { logAudit } from '@/lib/audit';
import { checkLimit } from '@/lib/limits';
import { isWorkDynamicEngineEnabled } from '@/lib/pillar-flags';
import { WORK_TEMPLATE } from '@/lib/pillar-templates';
import { ensurePillarForUser, insertPillarItem } from '@/lib/pillar-writes';

export const dynamic = 'force-dynamic';

const workblockSchema = z.object({
  type: z.enum(['ticket', 'task', 'meeting', 'review']).default('task'),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['backlog', 'today', 'in-progress', 'blocked', 'done']).default('backlog'),
  priority: z.enum(['low', 'med', 'high']).default('med'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  client: z.string().default(''),
  notes: z.string().optional(),
  links: z.record(z.string(), z.string()).optional(),
});

const importSchema = z.object({
  workblocks: z.array(workblockSchema).min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const { userId, tokenId } = await requireApiToken(request, ['work:write']);
    await enforceApiRateLimit(tokenId, 'import/workblocks');

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

    const limitCheck = await checkLimit(userId, 'workblocks');
    const remaining = limitCheck.limit === null ? Infinity : Math.max(0, limitCheck.limit - limitCheck.current);

    // Phase 6c: when Work is on the dynamic engine, import goes to
    // pillar_items — the legacy workblocks table would otherwise become
    // invisible to /work's own UI.
    const pillarId = isWorkDynamicEngineEnabled() ? await ensurePillarForUser(userId, WORK_TEMPLATE) : null;

    for (let i = 0; i < parsed.data.workblocks.length; i++) {
      if (i >= remaining) {
        errors.push({ index: i, error: `plan limit reached (${limitCheck.limit} workblocks)` });
        continue;
      }
      const w = parsed.data.workblocks[i];
      try {
        if (pillarId) {
          const id = await insertPillarItem({
            userId,
            pillarId,
            isContainer: false,
            title: w.title,
            description: w.description ?? null,
            status: w.status,
            dueDate: w.due_date ?? null,
            fields: {
              type: w.type,
              priority: w.priority,
              client: w.client,
              notes: w.notes ?? null,
              links: w.links ?? {},
            },
          });
          imported.push(id);
        } else {
          const [row] = await db
            .insert(schema.workblocks)
            .values({
              user_id: userId,
              type: w.type,
              title: w.title,
              description: w.description ?? null,
              status: w.status,
              priority: w.priority,
              due_date: w.due_date ?? null,
              client: w.client,
              notes: w.notes ?? null,
              links: w.links ?? {},
            })
            .returning({ id: schema.workblocks.id });
          if (row) imported.push(row.id);
        }
      } catch (err) {
        errors.push({ index: i, error: err instanceof Error ? err.message : 'unknown error' });
      }
    }

    logAudit({
      userId,
      action: 'api_import_workblocks',
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
    console.error('[api/v1/import/workblocks]', err);
    return Response.json({ error: 'Internal server error', code: 'internal_error' }, { status: 500 });
  }
}
