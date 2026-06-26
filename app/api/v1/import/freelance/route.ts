import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { requireApiToken, ApiAuthError } from '@/lib/api-auth';
import { enforceApiRateLimit } from '@/lib/api-rate-limit';
import { logAudit } from '@/lib/audit';
import { isFreelanceDynamicEngineEnabled } from '@/lib/pillar-flags';
import { FREELANCE_TEMPLATE } from '@/lib/pillar-templates';
import { ensurePillarForUser, insertPillarItem } from '@/lib/pillar-writes';

export const dynamic = 'force-dynamic';

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['backlog', 'today', 'in-progress', 'blocked', 'done']).default('backlog'),
  priority: z.enum(['low', 'med', 'high']).default('med'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

const clientSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['active', 'paused', 'blocked', 'archived']).default('active'),
  icon: z.string().optional(),
  stack: z.string().optional(),
  next_step: z.string().optional(),
  last_update: z.string().optional(),
  links: z.record(z.string(), z.string()).optional(),
  tasks: z.array(taskSchema).optional(),
});

const importSchema = z.object({
  clients: z.array(clientSchema).min(1).max(50),
});

export async function POST(request: Request) {
  try {
    const { userId, tokenId } = await requireApiToken(request, ['freelance:write']);
    await enforceApiRateLimit(tokenId, 'import/freelance');

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

    // Phase 5b: when Freelance is on the dynamic engine, import goes to
    // pillar_items — the legacy freelance_clients/tasks tables would
    // otherwise become invisible to /freelance's own UI. Clients are NOT
    // deduped by name here, same as the legacy path — every import call
    // creates a new client even if the name matches an existing one.
    const pillarId = isFreelanceDynamicEngineEnabled() ? await ensurePillarForUser(userId, FREELANCE_TEMPLATE) : null;

    for (let i = 0; i < parsed.data.clients.length; i++) {
      const c = parsed.data.clients[i];
      try {
        const result = await db.transaction(async (tx) => {
          if (pillarId) {
            const clientId = await insertPillarItem(
              {
                userId,
                pillarId,
                isContainer: true,
                title: c.name,
                description: c.description ?? null,
                status: c.status,
                fields: { icon: c.icon ?? null, stack: c.stack ?? null, next_step: c.next_step ?? null, last_update: c.last_update ?? null, links: c.links ?? {} },
              },
              tx,
            );

            if (c.tasks && c.tasks.length > 0) {
              for (const t of c.tasks) {
                await insertPillarItem(
                  {
                    userId,
                    pillarId,
                    parentItemId: clientId,
                    isContainer: false,
                    title: t.title,
                    description: t.description ?? null,
                    status: t.status,
                    dueDate: t.due_date ?? null,
                    fields: { priority: t.priority },
                  },
                  tx,
                );
              }
            }

            return clientId;
          }

          const [clientRow] = await tx
            .insert(schema.freelanceClients)
            .values({
              user_id: userId,
              name: c.name,
              description: c.description ?? null,
              status: c.status,
              icon: c.icon ?? null,
              stack: c.stack ?? null,
              next_step: c.next_step ?? null,
              last_update: c.last_update ?? null,
              links: c.links ?? {},
            })
            .returning({ id: schema.freelanceClients.id });

          if (!clientRow) throw new Error('Failed to insert client');

          if (c.tasks && c.tasks.length > 0) {
            await tx.insert(schema.freelanceTasks).values(
              c.tasks.map((t) => ({
                user_id: userId,
                client_id: clientRow.id,
                title: t.title,
                description: t.description ?? null,
                status: t.status,
                priority: t.priority,
                due_date: t.due_date ?? null,
              })),
            );
          }

          return clientRow.id;
        });

        imported.push(result);
      } catch (err) {
        errors.push({ index: i, error: err instanceof Error ? err.message : 'unknown error' });
      }
    }

    logAudit({
      userId,
      action: 'api_import_freelance',
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
    console.error('[api/v1/import/freelance]', err);
    return Response.json({ error: 'Internal server error', code: 'internal_error' }, { status: 500 });
  }
}
