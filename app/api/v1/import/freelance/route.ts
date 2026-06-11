import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { requireApiToken, ApiAuthError } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { checkLimit } from '@/lib/limits';

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

    // Each item creates one client (plus its tasks), so gate on the client limit.
    const limitCheck = await checkLimit(userId, 'freelance_clients');
    const remaining = limitCheck.limit === null ? Infinity : Math.max(0, limitCheck.limit - limitCheck.current);

    for (let i = 0; i < parsed.data.clients.length; i++) {
      if (i >= remaining) {
        errors.push({ index: i, error: `plan limit reached (${limitCheck.limit} freelance clients)` });
        continue;
      }
      const c = parsed.data.clients[i];
      try {
        // Insert client + tasks in a transaction
        const result = await db.transaction(async (tx) => {
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
      return Response.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error('[api/v1/import/freelance]', err);
    return Response.json({ error: 'Internal server error', code: 'internal_error' }, { status: 500 });
  }
}
