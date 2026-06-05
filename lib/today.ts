import 'server-only';
import { db, schema } from '@/lib/db';
import { and, eq, inArray, lte, ne, desc, asc, sql } from 'drizzle-orm';
import { todayKey, inDaysISO } from '@/lib/date';
import type {
  Subject,
  Assignment,
  Workblock,
  BuildItem,
  ScheduleSlot,
  FreelanceClient,
  FreelanceTask,
  OwnProject,
  CommunityItem,
} from '@/lib/types';

export type TodayClass = {
  subject: Subject;
  slot: ScheduleSlot;
};

export type TodayData = {
  classes: TodayClass[];
  assignments: (Assignment & { subjectName: string | null })[];
  workblocks: Workblock[];
  buildItems: BuildItem[];
};

function rowToSubject(r: typeof schema.subjects.$inferSelect): Subject {
  return {
    id: r.id,
    name: r.name,
    semester: r.semester,
    schedule: (r.schedule ?? []) as ScheduleSlot[],
    active: r.active,
    vault_slug: r.vault_slug,
    created_at: r.created_at.toISOString(),
  };
}

function rowToAssignment(r: typeof schema.assignments.$inferSelect): Assignment {
  return {
    id: r.id,
    subject_id: r.subject_id,
    title: r.title,
    description: r.description,
    due_date: r.due_date,
    status: r.status,
    created_at: r.created_at.toISOString(),
    completed_at: r.completed_at ? r.completed_at.toISOString() : null,
  };
}

function rowToWorkblock(r: typeof schema.workblocks.$inferSelect): Workblock {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    due_date: r.due_date,
    client: r.client,
    notes: r.notes,
    links: r.links,
    position: r.position,
    created_at: r.created_at.toISOString(),
    completed_at: r.completed_at ? r.completed_at.toISOString() : null,
  };
}

function rowToBuildItem(r: typeof schema.buildItems.$inferSelect): BuildItem {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    draft: r.draft,
    hook: r.hook,
    platforms: r.platforms,
    status: r.status,
    scheduled_for: r.scheduled_for ? r.scheduled_for.toISOString() : null,
    published_at: r.published_at ? r.published_at.toISOString() : null,
    links: r.links,
    metrics: r.metrics,
    related_project: r.related_project,
    created_at: r.created_at.toISOString(),
  };
}

// Priorities sortable as enum: high > med > low
const PRIORITY_ORDER = sql`case ${schema.workblocks.priority} when 'high' then 0 when 'med' then 1 when 'low' then 2 else 3 end`;

export async function getTodayData(): Promise<TodayData> {
  const day = todayKey();

  // ----- UNIVERSIDAD -----
  const subjectsRows = await db
    .select()
    .from(schema.subjects)
    .where(eq(schema.subjects.active, true));

  const allSubjects = subjectsRows.map(rowToSubject);

  const classes: TodayClass[] = [];
  for (const s of allSubjects) {
    for (const slot of s.schedule) {
      if (slot.day === day) classes.push({ subject: s, slot });
    }
  }
  classes.sort((a, b) => a.slot.start.localeCompare(b.slot.start));

  const assignmentsRows = await db
    .select()
    .from(schema.assignments)
    .where(
      and(
        ne(schema.assignments.status, 'done'),
        lte(schema.assignments.due_date, inDaysISO(7)),
      ),
    )
    .orderBy(asc(schema.assignments.due_date));

  const subjectMap = new Map(allSubjects.map((s) => [s.id, s.name]));
  const assignments = assignmentsRows.map((r) => ({
    ...rowToAssignment(r),
    subjectName: r.subject_id ? subjectMap.get(r.subject_id) ?? null : null,
  }));

  // ----- TRABAJO -----
  const [activeRows, backlogHighRows] = await Promise.all([
    db
      .select()
      .from(schema.workblocks)
      .where(inArray(schema.workblocks.status, ['today', 'in-progress']))
      .orderBy(PRIORITY_ORDER, asc(schema.workblocks.position)),
    db
      .select()
      .from(schema.workblocks)
      .where(
        and(
          eq(schema.workblocks.status, 'backlog'),
          eq(schema.workblocks.priority, 'high'),
        ),
      )
      .orderBy(asc(schema.workblocks.position)),
  ]);

  const workblocks = [
    ...activeRows.map(rowToWorkblock),
    ...backlogHighRows.map(rowToWorkblock),
  ];

  // ----- BUILD -----
  const buildRows = await db
    .select()
    .from(schema.buildItems)
    .where(inArray(schema.buildItems.status, ['idea', 'draft']))
    .orderBy(desc(schema.buildItems.created_at))
    .limit(8);

  const buildItems = buildRows.map(rowToBuildItem);

  return { classes, assignments, workblocks, buildItems };
}

function rowToFreelanceClient(r: typeof schema.freelanceClients.$inferSelect): FreelanceClient {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    description: r.description,
    status: r.status,
    stack: r.stack,
    next_step: r.next_step,
    last_update: r.last_update,
    links: r.links,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}

function rowToFreelanceTask(r: typeof schema.freelanceTasks.$inferSelect): FreelanceTask {
  return {
    id: r.id,
    client_id: r.client_id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    due_date: r.due_date,
    created_at: r.created_at.toISOString(),
    completed_at: r.completed_at ? r.completed_at.toISOString() : null,
  };
}

function rowToOwnProject(r: typeof schema.ownProjects.$inferSelect): OwnProject {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    description: r.description,
    status: r.status,
    last_update: r.last_update,
    next_step: r.next_step,
    links: r.links,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}

function rowToCommunityItem(r: typeof schema.communityItems.$inferSelect): CommunityItem {
  return {
    id: r.id,
    organization: r.organization,
    title: r.title,
    description: r.description,
    status: r.status,
    due_date: r.due_date,
    created_at: r.created_at.toISOString(),
  };
}

// Re-exports para que otros archivos no tengan que re-implementar el mapeo
export {
  rowToSubject,
  rowToAssignment,
  rowToWorkblock,
  rowToBuildItem,
  rowToFreelanceClient,
  rowToFreelanceTask,
  rowToOwnProject,
  rowToCommunityItem,
};
