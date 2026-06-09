import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, gte } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { rowToWorkblock, rowToAssignment, rowToBuildItem, rowToSubject } from '@/lib/today';
import { buildExportFiles, summaryLog, type ExportPayload } from '@/lib/vault-export';
import { DEFAULT_USER_SETTINGS } from '@/lib/types';
import type { Subject, UserSettings } from '@/lib/types';

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
  if (cronSecret && !isCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!cronSecret && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const range = lastWeekRange();

  // Fetch all users with export_enabled = true.
  const userRows = await db.select().from(schema.users).where(eq(schema.users.active, true));
  const exportUsers = userRows.filter((u) => {
    const settings: UserSettings = { ...DEFAULT_USER_SETTINGS, ...(u.settings as Partial<UserSettings>) };
    return settings.export_enabled;
  });

  const results: Array<{
    userId: string;
    email: string;
    counts: { workblocks: number; assignments: number; buildItems: number };
    files: { path: string; content: string }[];
    summary: string;
  }> = [];

  for (const userRow of exportUsers) {
    const settings: UserSettings = { ...DEFAULT_USER_SETTINGS, ...(userRow.settings as Partial<UserSettings>) };

    const [wbRows, assnRows, biRows, subRows] = await Promise.all([
      db
        .select()
        .from(schema.workblocks)
        .where(
          and(
            eq(schema.workblocks.user_id, userRow.id),
            eq(schema.workblocks.status, 'done'),
            gte(schema.workblocks.completed_at, range.startDate),
          ),
        ),
      db
        .select()
        .from(schema.assignments)
        .where(
          and(
            eq(schema.assignments.user_id, userRow.id),
            eq(schema.assignments.status, 'done'),
            gte(schema.assignments.completed_at, range.startDate),
          ),
        ),
      db
        .select()
        .from(schema.buildItems)
        .where(
          and(
            eq(schema.buildItems.user_id, userRow.id),
            eq(schema.buildItems.status, 'published'),
            gte(schema.buildItems.published_at, range.startDate),
          ),
        ),
      db.select().from(schema.subjects).where(eq(schema.subjects.user_id, userRow.id)),
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

    const files = buildExportFiles(payload, settings.vault_path);
    const summary = summaryLog(payload, files);

    await db.insert(schema.vaultExports).values({
      user_id: userRow.id,
      item_count: workblocks.length + assignments.length + buildItems.length,
      items: [
        ...workblocks.map((w) => ({ type: 'workblock', id: w.id, title: w.title })),
        ...assignments.map((a) => ({ type: 'assignment', id: a.id, title: a.title })),
        ...buildItems.map((b) => ({ type: 'build', id: b.id, title: b.title })),
      ],
      status: 'success',
    });

    results.push({
      userId: userRow.id,
      email: userRow.email,
      counts: { workblocks: workblocks.length, assignments: assignments.length, buildItems: buildItems.length },
      files,
      summary,
    });
  }

  return NextResponse.json({
    week: { start: range.start, end: range.end },
    users: results.length,
    results,
  });
}
