import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireApiToken, ApiAuthError } from '@/lib/api-auth';
import { enforceApiRateLimit } from '@/lib/api-rate-limit';
import { logAudit } from '@/lib/audit';
import { checkLimit } from '@/lib/limits';

export const dynamic = 'force-dynamic';

function currentSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const half = month <= 6 ? '1' : '2';
  return `${year}-${half}`;
}

const assignmentSchema = z.object({
  subject_name: z.string().min(1),
  semester: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(['todo', 'in-progress', 'done']).default('todo'),
  resources: z
    .array(z.object({ name: z.string(), url: z.string(), type: z.string().optional() }))
    .optional(),
});

const importSchema = z.object({
  assignments: z.array(assignmentSchema).min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const { userId, tokenId } = await requireApiToken(request, ['uni:write']);
    await enforceApiRateLimit(tokenId, 'import/assignments');

    const body = await request.json().catch(() => null);
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const importedIds: string[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    const subjectCache = new Map<string, string>(); // name -> id

    const limitCheck = await checkLimit(userId, 'assignments');
    const remaining = limitCheck.limit === null ? Infinity : Math.max(0, limitCheck.limit - limitCheck.current);

    for (let i = 0; i < parsed.data.assignments.length; i++) {
      if (i >= remaining) {
        errors.push({ index: i, error: `plan limit reached (${limitCheck.limit} assignments)` });
        continue;
      }
      const a = parsed.data.assignments[i];
      try {
        const semester = a.semester ?? currentSemester();
        const cacheKey = `${a.subject_name}::${semester}`;

        let subjectId = subjectCache.get(cacheKey);
        if (!subjectId) {
          const [existing] = await db
            .select({ id: schema.subjects.id })
            .from(schema.subjects)
            .where(
              and(
                eq(schema.subjects.user_id, userId),
                eq(schema.subjects.name, a.subject_name),
                eq(schema.subjects.semester, semester),
              ),
            )
            .limit(1);

          if (existing) {
            subjectId = existing.id;
          } else {
            const [created] = await db
              .insert(schema.subjects)
              .values({ user_id: userId, name: a.subject_name, semester })
              .returning({ id: schema.subjects.id });
            subjectId = created!.id;
          }
          subjectCache.set(cacheKey, subjectId);
        }

        const [row] = await db
          .insert(schema.assignments)
          .values({
            user_id: userId,
            subject_id: subjectId,
            title: a.title,
            description: a.description ?? null,
            due_date: a.due_date ?? null,
            status: a.status,
            resources: a.resources ?? [],
          })
          .returning({ id: schema.assignments.id });

        if (row) importedIds.push(row.id);
      } catch (err) {
        errors.push({ index: i, error: err instanceof Error ? err.message : 'unknown error' });
      }
    }

    logAudit({
      userId,
      action: 'api_import_assignments',
      metadata: { count: importedIds.length, token_id: tokenId },
    });

    return Response.json({ imported: importedIds.length, ids: importedIds, errors });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return Response.json(
        { error: err.message, code: err.code, ...(err.retryAfter ? { retry_after: err.retryAfter } : {}) },
        { status: err.status, headers: err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : undefined },
      );
    }
    console.error('[api/v1/import/assignments]', err);
    return Response.json({ error: 'Internal server error', code: 'internal_error' }, { status: 500 });
  }
}
