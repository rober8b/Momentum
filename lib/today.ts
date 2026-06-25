import 'server-only';
import { db, schema } from '@/lib/db';
import { and, eq, inArray, lte, desc, asc, sql } from 'drizzle-orm';
import { todayKey, inDaysISO, formatFullDate } from '@/lib/date';
import { rowToPillarItem } from '@/lib/pillars';
import {
  isFreelanceDynamicEngineEnabled,
  isCommunityDynamicEngineEnabled,
  isUniDynamicEngineEnabled,
} from '@/lib/pillar-flags';
import { FREELANCE_TEMPLATE, COMMUNITY_TEMPLATE, UNI_TEMPLATE } from '@/lib/pillar-templates';
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
  Organization,
  PillarItem,
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
  freelanceTasks: (FreelanceTask & { clientName: string })[];
  communityItems: CommunityItem[];
  tz: string;
  formattedDate: string;
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
    resources: (r.resources ?? []) as Assignment['resources'],
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

// ----- DYNAMIC PILLAR ENGINE BRIDGE -----
// Phase 5: Today/search/export must see items created through a cut-over
// pillar's UI (which write only to pillar_items, never the legacy tables —
// see app/p/actions.ts). These helpers read pillar_items and map rows back
// into the exact legacy shapes the rest of this file already produces, so
// every downstream filter/sort/JSX stays untouched. Deliberately NOT in
// lib/pillars.ts: that file is imported by components/pillars/GenericList.tsx
// ('use client'), so adding a db import there would leak server-only code
// into the client bundle. This file is already db-importing and consumed
// only by server code (app/page.tsx, app/api/export/route.ts).
async function getPillarItemsByKey(userId: string, pillarKey: string): Promise<PillarItem[]> {
  const [pillarRow] = await db
    .select()
    .from(schema.pillars)
    .where(and(eq(schema.pillars.user_id, userId), eq(schema.pillars.key, pillarKey)))
    .limit(1);
  if (!pillarRow) return [];

  const itemRows = await db
    .select()
    .from(schema.pillarItems)
    .where(and(eq(schema.pillarItems.user_id, userId), eq(schema.pillarItems.pillar_id, pillarRow.id)));
  return itemRows.map(rowToPillarItem);
}

function pillarItemToSubject(item: PillarItem): Subject {
  return {
    id: item.id,
    name: item.title,
    semester: (item.fields.semester as string) ?? '',
    schedule: Array.isArray(item.fields.schedule) ? (item.fields.schedule as ScheduleSlot[]) : [],
    active: item.status === 'active',
    vault_slug: (item.fields.vault_slug as string | null) ?? null,
    created_at: item.created_at,
  };
}

function pillarItemToAssignment(item: PillarItem): Assignment {
  return {
    id: item.id,
    subject_id: item.parent_item_id,
    title: item.title,
    description: item.description,
    due_date: item.due_date,
    status: item.status as Assignment['status'],
    resources: (item.fields.resources ?? []) as Assignment['resources'],
    created_at: item.created_at,
    completed_at: item.completed_at,
  };
}

function pillarItemToFreelanceTask(item: PillarItem): FreelanceTask {
  return {
    id: item.id,
    client_id: item.parent_item_id,
    title: item.title,
    description: item.description,
    status: item.status as FreelanceTask['status'],
    priority: (item.fields.priority as FreelanceTask['priority']) ?? 'med',
    due_date: item.due_date,
    created_at: item.created_at,
    completed_at: item.completed_at,
  };
}

function pillarItemToBuildItem(item: PillarItem): BuildItem {
  return {
    id: item.id,
    type: (item.fields.type as BuildItem['type']) ?? 'project',
    title: item.title,
    draft: (item.fields.draft as string | null) ?? null,
    hook: (item.fields.hook as string | null) ?? null,
    platforms: Array.isArray(item.fields.platforms) ? (item.fields.platforms as string[]) : ['x', 'linkedin'],
    status: item.status as BuildItem['status'],
    scheduled_for: (item.fields.scheduled_for as string | null) ?? null,
    published_at: item.completed_at,
    links: (item.fields.links as Record<string, string>) ?? {},
    metrics: (item.fields.metrics as Record<string, number>) ?? {},
    related_project: (item.fields.related_project as string | null) ?? null,
    created_at: item.created_at,
  };
}

function pillarItemToCommunityItem(item: PillarItem, orgName: string | null): CommunityItem {
  return {
    id: item.id,
    organization_id: item.parent_item_id,
    organization_name: orgName,
    title: item.title,
    description: item.description,
    status: item.status as CommunityItem['status'],
    due_date: item.due_date,
    created_at: item.created_at,
  };
}

export async function getTodayData(userId: string, tz: string): Promise<TodayData> {
  const day = todayKey(tz);

  // ----- UNIVERSIDAD -----
  let allSubjects: Subject[];
  let unfilteredAssignments: Assignment[];
  if (isUniDynamicEngineEnabled()) {
    const items = await getPillarItemsByKey(userId, UNI_TEMPLATE.key);
    allSubjects = items.filter((i) => i.is_container && i.status === 'active').map(pillarItemToSubject);
    unfilteredAssignments = items.filter((i) => !i.is_container).map(pillarItemToAssignment);
  } else {
    const subjectsRows = await db
      .select()
      .from(schema.subjects)
      .where(and(eq(schema.subjects.user_id, userId), eq(schema.subjects.active, true)));
    allSubjects = subjectsRows.map(rowToSubject);

    const assignmentsRows = await db.select().from(schema.assignments).where(eq(schema.assignments.user_id, userId));
    unfilteredAssignments = assignmentsRows.map(rowToAssignment);
  }

  const classes: TodayClass[] = [];
  for (const s of allSubjects) {
    for (const slot of s.schedule) {
      if (slot.day === day) classes.push({ subject: s, slot });
    }
  }
  classes.sort((a, b) => a.slot.start.localeCompare(b.slot.start));

  const dueLimit = inDaysISO(7, tz);
  const subjectMap = new Map(allSubjects.map((s) => [s.id, s.name]));
  const assignments = unfilteredAssignments
    .filter((a) => a.status !== 'done' && a.due_date !== null && a.due_date <= dueLimit)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    .map((a) => ({
      ...a,
      subjectName: a.subject_id ? subjectMap.get(a.subject_id) ?? null : null,
    }));

  // ----- TRABAJO -----
  const [activeRows, backlogHighRows] = await Promise.all([
    db
      .select()
      .from(schema.workblocks)
      .where(and(eq(schema.workblocks.user_id, userId), inArray(schema.workblocks.status, ['today', 'in-progress'])))
      .orderBy(PRIORITY_ORDER, asc(schema.workblocks.position)),
    db
      .select()
      .from(schema.workblocks)
      .where(
        and(
          eq(schema.workblocks.user_id, userId),
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
    .where(and(eq(schema.buildItems.user_id, userId), inArray(schema.buildItems.status, ['idea', 'draft'])))
    .orderBy(desc(schema.buildItems.created_at))
    .limit(8);

  const buildItems = buildRows.map(rowToBuildItem);

  // ----- FREELANCE -----
  let freelanceTasks: (FreelanceTask & { clientName: string })[];
  if (isFreelanceDynamicEngineEnabled()) {
    const items = await getPillarItemsByKey(userId, FREELANCE_TEMPLATE.key);
    const clientNameMap = new Map(items.filter((i) => i.is_container).map((c) => [c.id, c.title]));
    freelanceTasks = items
      .filter((i) => !i.is_container && ['today', 'in-progress'].includes(i.status))
      .map(pillarItemToFreelanceTask)
      .map((t) => ({ ...t, clientName: t.client_id ? clientNameMap.get(t.client_id) ?? '' : '' }));
  } else {
    const ftRows = await db
      .select()
      .from(schema.freelanceTasks)
      .where(and(eq(schema.freelanceTasks.user_id, userId), inArray(schema.freelanceTasks.status, ['today', 'in-progress'])));

    const clientIds = [...new Set(ftRows.map((r) => r.client_id).filter(Boolean))] as string[];
    const clientNameMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const clientRows = await db
        .select({ id: schema.freelanceClients.id, name: schema.freelanceClients.name })
        .from(schema.freelanceClients)
        .where(inArray(schema.freelanceClients.id, clientIds));
      for (const c of clientRows) clientNameMap.set(c.id, c.name);
    }

    freelanceTasks = ftRows.map((r) => ({
      ...rowToFreelanceTask(r),
      clientName: r.client_id ? clientNameMap.get(r.client_id) ?? '' : '',
    }));
  }

  // ----- COMUNIDAD -----
  let communityItems: CommunityItem[];
  if (isCommunityDynamicEngineEnabled()) {
    const items = await getPillarItemsByKey(userId, COMMUNITY_TEMPLATE.key);
    const orgNameMap = new Map(items.filter((i) => i.is_container).map((o) => [o.id, o.title]));
    const dueLimit3 = inDaysISO(3, tz);
    communityItems = items
      .filter((i) => !i.is_container && i.status === 'pending' && i.due_date !== null && i.due_date <= dueLimit3)
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
      .map((i) => pillarItemToCommunityItem(i, i.parent_item_id ? orgNameMap.get(i.parent_item_id) ?? null : null));
  } else {
    const communityRows = await db
      .select({
        item: schema.communityItems,
        org_name: schema.organizations.name,
      })
      .from(schema.communityItems)
      .leftJoin(schema.organizations, eq(schema.communityItems.organization_id, schema.organizations.id))
      .where(
        and(
          eq(schema.communityItems.user_id, userId),
          eq(schema.communityItems.status, 'pending'),
          lte(schema.communityItems.due_date, inDaysISO(3, tz)),
        ),
      )
      .orderBy(asc(schema.communityItems.due_date));

    communityItems = communityRows.map((r) => rowToCommunityItem(r.item, r.org_name ?? null));
  }

  return {
    classes,
    assignments,
    workblocks,
    buildItems,
    freelanceTasks,
    communityItems,
    tz,
    formattedDate: formatFullDate(tz),
  };
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

function rowToCommunityItem(r: typeof schema.communityItems.$inferSelect, orgName: string | null = null): CommunityItem {
  return {
    id: r.id,
    organization_id: r.organization_id,
    organization_name: orgName,
    title: r.title,
    description: r.description,
    status: r.status,
    due_date: r.due_date,
    created_at: r.created_at.toISOString(),
  };
}

function rowToOrganization(r: typeof schema.organizations.$inferSelect): Organization {
  return {
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    slug: r.slug,
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
  rowToOrganization,
  getPillarItemsByKey,
  pillarItemToSubject,
  pillarItemToAssignment,
  pillarItemToBuildItem,
};
