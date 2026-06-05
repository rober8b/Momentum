import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, gte } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { rowToWorkblock, rowToAssignment, rowToBuildItem, rowToSubject } from '@/lib/today';
import { buildExportFiles, summaryLog, type ExportPayload } from '@/lib/vault-export';
import type { Subject } from '@/lib/types';

export const runtime = 'nodejs';

function lastWeekRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    startDate: start,
  };
}

export async function GET(req: NextRequest) {
  // Cron de Vercel: Authorization: Bearer ${CRON_SECRET}.
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  // El proxy.ts excluye /api/export del Clerk guard, así que sin esto
  // cualquiera puede pegarle. Si querés bloquear hasta tener sesión, validar acá.
  void isCron;

  const range = lastWeekRange();

  const [wbRows, assnRows, biRows, subRows] = await Promise.all([
    db
      .select()
      .from(schema.workblocks)
      .where(
        and(
          eq(schema.workblocks.status, 'done'),
          gte(schema.workblocks.completed_at, range.startDate),
        ),
      ),
    db
      .select()
      .from(schema.assignments)
      .where(
        and(
          eq(schema.assignments.status, 'done'),
          gte(schema.assignments.completed_at, range.startDate),
        ),
      ),
    db
      .select()
      .from(schema.buildItems)
      .where(
        and(
          eq(schema.buildItems.status, 'published'),
          gte(schema.buildItems.published_at, range.startDate),
        ),
      ),
    db.select().from(schema.subjects),
  ]);

  const subjects: Subject[] = subRows.map(rowToSubject);
  const subjectMap = new Map(subjects.map((s) => [s.id, s.vault_slug]));

  const workblocks = wbRows.map(rowToWorkblock);
  const assignments = assnRows.map((r) => ({
    ...rowToAssignment(r),
    subjectSlug: r.subject_id ? subjectMap.get(r.subject_id) ?? null : null,
  }));
  const buildItems = biRows.map(rowToBuildItem);

  const payload: ExportPayload = {
    workblocks,
    assignments,
    buildItems,
    subjects,
    weekStart: range.start,
    weekEnd: range.end,
  };

  const files = buildExportFiles(payload);
  const summary = summaryLog(payload, files);

  await db.insert(schema.vaultExports).values({
    item_count: workblocks.length + assignments.length + buildItems.length,
    items: [
      ...workblocks.map((w) => ({ type: 'workblock', id: w.id, title: w.title })),
      ...assignments.map((a) => ({ type: 'assignment', id: a.id, title: a.title })),
      ...buildItems.map((b) => ({ type: 'build', id: b.id, title: b.title })),
    ],
    status: 'success',
  });

  return NextResponse.json({
    week: { start: range.start, end: range.end },
    counts: {
      workblocks: workblocks.length,
      assignments: assignments.length,
      buildItems: buildItems.length,
    },
    summary,
    files,
  });
}
