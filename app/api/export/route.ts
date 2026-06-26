import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, gte } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import {
  rowToWorkblock,
  rowToAssignment,
  rowToBuildItem,
  rowToSubject,
  getPillarItemsByKey,
  pillarItemToSubject,
  pillarItemToAssignment,
  pillarItemToBuildItem,
} from '@/lib/today';
import { rowToPillarItem } from '@/lib/pillars';
import { buildExportFiles, summaryLog, type ExportPayload } from '@/lib/vault-export';
import { isUniDynamicEngineEnabled, isBuildDynamicEngineEnabled } from '@/lib/pillar-flags';
import { UNI_TEMPLATE, BUILD_TEMPLATE } from '@/lib/pillar-templates';
import { DEFAULT_USER_SETTINGS } from '@/lib/types';
import type { Subject, Assignment, BuildItem, UserSettings } from '@/lib/types';

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

    const wbRows = await db
      .select()
      .from(schema.workblocks)
      .where(
        and(
          eq(schema.workblocks.user_id, userRow.id),
          eq(schema.workblocks.status, 'done'),
          gte(schema.workblocks.completed_at, range.startDate),
        ),
      );
    const workblocks = wbRows.map(rowToWorkblock);

    // Phase 6b: Build's published items must come from pillar_items when
    // cut over, same reasoning as Uni below. Queried directly (not via
    // getPillarItemsByKey) with the status+completed_at filter pushed into
    // SQL — published items grow unboundedly (years of posts), so this must
    // not fetch every build item ever just to filter in JS.
    let buildItems: BuildItem[];
    if (isBuildDynamicEngineEnabled()) {
      const [buildPillarRow] = await db
        .select({ id: schema.pillars.id })
        .from(schema.pillars)
        .where(and(eq(schema.pillars.user_id, userRow.id), eq(schema.pillars.key, BUILD_TEMPLATE.key)))
        .limit(1);

      if (buildPillarRow) {
        const itemRows = await db
          .select()
          .from(schema.pillarItems)
          .where(
            and(
              eq(schema.pillarItems.pillar_id, buildPillarRow.id),
              eq(schema.pillarItems.status, 'published'),
              gte(schema.pillarItems.completed_at, range.startDate),
            ),
          );
        buildItems = itemRows.map(rowToPillarItem).map(pillarItemToBuildItem);
      } else {
        buildItems = [];
      }
    } else {
      const biRows = await db
        .select()
        .from(schema.buildItems)
        .where(
          and(
            eq(schema.buildItems.user_id, userRow.id),
            eq(schema.buildItems.status, 'published'),
            gte(schema.buildItems.published_at, range.startDate),
          ),
        );
      buildItems = biRows.map(rowToBuildItem);
    }

    // Phase 5: Uni's assignments/subjects must come from pillar_items when
    // cut over — new assignments created through the dynamic UI write only
    // there, never to the legacy tables. See lib/today.ts's getPillarItemsByKey.
    let subjects: Subject[];
    let doneAssignments: Assignment[];
    if (isUniDynamicEngineEnabled()) {
      const items = await getPillarItemsByKey(userRow.id, UNI_TEMPLATE.key);
      subjects = items.filter((i) => i.is_container).map(pillarItemToSubject);
      doneAssignments = items
        .filter((i) => !i.is_container)
        .map(pillarItemToAssignment)
        .filter((a) => a.status === 'done' && a.completed_at !== null && new Date(a.completed_at) >= range.startDate);
    } else {
      const [subRows, assnRows] = await Promise.all([
        db.select().from(schema.subjects).where(eq(schema.subjects.user_id, userRow.id)),
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
      ]);
      subjects = subRows.map(rowToSubject);
      doneAssignments = assnRows.map(rowToAssignment);
    }

    const subjectMap = new Map(subjects.map((s) => [s.id, s.vault_slug]));

    const assignments = doneAssignments.map((a) => ({
      ...a,
      subjectSlug: a.subject_id ? subjectMap.get(a.subject_id) ?? null : null,
    }));

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
