'use server';

import { and, eq, ilike } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import {
  isProjectsDynamicEngineEnabled,
  isFreelanceDynamicEngineEnabled,
  isCommunityDynamicEngineEnabled,
  isUniDynamicEngineEnabled,
} from '@/lib/pillar-flags';
import { PROJECTS_TEMPLATE, FREELANCE_TEMPLATE, COMMUNITY_TEMPLATE, UNI_TEMPLATE } from '@/lib/pillar-templates';

export type SearchResult = {
  id: string;
  title: string;
  type: 'assignment' | 'workblock' | 'build' | 'freelance-client' | 'freelance-task' | 'project' | 'community';
  href: string;
  meta?: string;
};

// Phase 5: a cut-over pillar's UI writes only to pillar_items (see
// app/p/actions.ts), never the legacy tables — so search must read
// pillar_items for any pillar whose dynamic engine flag is on, or newly
// created items become unsearchable. Each helper mirrors its legacy
// counterpart's query shape (ilike + limit 3) exactly, just against the
// generic engine's tables.

async function searchProjects(uid: string, pattern: string): Promise<SearchResult[]> {
  if (isProjectsDynamicEngineEnabled()) {
    const rows = await db
      .select({ id: schema.pillarItems.id, title: schema.pillarItems.title })
      .from(schema.pillarItems)
      .innerJoin(schema.pillars, eq(schema.pillars.id, schema.pillarItems.pillar_id))
      .where(and(eq(schema.pillars.user_id, uid), eq(schema.pillars.key, PROJECTS_TEMPLATE.key), ilike(schema.pillarItems.title, pattern)))
      .limit(3);
    return rows.map((p) => ({ id: p.id, title: p.title, type: 'project' as const, href: '/projects', meta: 'proyecto' }));
  }

  const rows = await db
    .select({ id: schema.ownProjects.id, name: schema.ownProjects.name })
    .from(schema.ownProjects)
    .where(and(eq(schema.ownProjects.user_id, uid), ilike(schema.ownProjects.name, pattern)))
    .limit(3);
  return rows.map((p) => ({ id: p.id, title: p.name, type: 'project' as const, href: '/projects', meta: 'proyecto' }));
}

async function searchFreelanceClients(uid: string, pattern: string): Promise<SearchResult[]> {
  if (isFreelanceDynamicEngineEnabled()) {
    const rows = await db
      .select({ id: schema.pillarItems.id, title: schema.pillarItems.title })
      .from(schema.pillarItems)
      .innerJoin(schema.pillars, eq(schema.pillars.id, schema.pillarItems.pillar_id))
      .where(and(
        eq(schema.pillars.user_id, uid),
        eq(schema.pillars.key, FREELANCE_TEMPLATE.key),
        eq(schema.pillarItems.is_container, true),
        ilike(schema.pillarItems.title, pattern),
      ))
      .limit(3);
    // The cut-over client page resolves either a pillar_items.id or
    // fields.legacy_id, so linking by the dynamic id always works.
    return rows.map((c) => ({ id: c.id, title: c.title, type: 'freelance-client' as const, href: `/freelance/${c.id}`, meta: 'cliente' }));
  }

  const rows = await db
    .select({ id: schema.freelanceClients.id, name: schema.freelanceClients.name })
    .from(schema.freelanceClients)
    .where(and(eq(schema.freelanceClients.user_id, uid), ilike(schema.freelanceClients.name, pattern)))
    .limit(3);
  return rows.map((c) => ({ id: c.id, title: c.name, type: 'freelance-client' as const, href: `/freelance/${c.id}`, meta: 'cliente' }));
}

async function searchFreelanceTasks(uid: string, pattern: string): Promise<SearchResult[]> {
  if (isFreelanceDynamicEngineEnabled()) {
    const rows = await db
      .select({ id: schema.pillarItems.id, title: schema.pillarItems.title, client_id: schema.pillarItems.parent_item_id })
      .from(schema.pillarItems)
      .innerJoin(schema.pillars, eq(schema.pillars.id, schema.pillarItems.pillar_id))
      .where(and(
        eq(schema.pillars.user_id, uid),
        eq(schema.pillars.key, FREELANCE_TEMPLATE.key),
        eq(schema.pillarItems.is_container, false),
        ilike(schema.pillarItems.title, pattern),
      ))
      .limit(3);
    return rows.map((t) => ({
      id: t.id,
      title: t.title,
      type: 'freelance-task' as const,
      href: t.client_id ? `/freelance/${t.client_id}` : '/freelance',
      meta: 'tarea freelance',
    }));
  }

  const rows = await db
    .select({ id: schema.freelanceTasks.id, title: schema.freelanceTasks.title, client_id: schema.freelanceTasks.client_id })
    .from(schema.freelanceTasks)
    .where(and(eq(schema.freelanceTasks.user_id, uid), ilike(schema.freelanceTasks.title, pattern)))
    .limit(3);
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    type: 'freelance-task' as const,
    href: t.client_id ? `/freelance/${t.client_id}` : '/freelance',
    meta: 'tarea freelance',
  }));
}

async function searchCommunityItems(uid: string, pattern: string): Promise<SearchResult[]> {
  if (isCommunityDynamicEngineEnabled()) {
    const rows = await db
      .select({ id: schema.pillarItems.id, title: schema.pillarItems.title })
      .from(schema.pillarItems)
      .innerJoin(schema.pillars, eq(schema.pillars.id, schema.pillarItems.pillar_id))
      .where(and(
        eq(schema.pillars.user_id, uid),
        eq(schema.pillars.key, COMMUNITY_TEMPLATE.key),
        eq(schema.pillarItems.is_container, false),
        ilike(schema.pillarItems.title, pattern),
      ))
      .limit(3);
    return rows.map((c) => ({ id: c.id, title: c.title, type: 'community' as const, href: '/community', meta: 'community' }));
  }

  const rows = await db
    .select({ id: schema.communityItems.id, title: schema.communityItems.title })
    .from(schema.communityItems)
    .where(and(eq(schema.communityItems.user_id, uid), ilike(schema.communityItems.title, pattern)))
    .limit(3);
  return rows.map((c) => ({ id: c.id, title: c.title, type: 'community' as const, href: '/community', meta: 'community' }));
}

// /uni/[subject]/[assignment] (the resources detail page) was never cut over
// to the dynamic engine (Phase 4 known gap) — it only resolves raw legacy
// subjects.id/assignments.id, no legacy_id fallback. So a matched assignment
// only gets that deep link if BOTH it and its parent subject carry
// fields.legacy_id (meaning real legacy rows back them); otherwise this
// falls back to the subject's cut-over drill-down list, which does resolve
// by id-or-legacy_id.
async function dynamicAssignmentHref(parentItemId: string | null, assignmentLegacyId: string | null): Promise<string> {
  if (!parentItemId) return '/uni';
  if (!assignmentLegacyId) return `/uni/${parentItemId}`;

  const [subject] = await db
    .select({ fields: schema.pillarItems.fields })
    .from(schema.pillarItems)
    .where(eq(schema.pillarItems.id, parentItemId))
    .limit(1);
  const subjectLegacyId = subject && typeof subject.fields?.legacy_id === 'string' ? subject.fields.legacy_id : null;
  return subjectLegacyId ? `/uni/${subjectLegacyId}/${assignmentLegacyId}` : `/uni/${parentItemId}`;
}

async function searchAssignments(uid: string, pattern: string): Promise<SearchResult[]> {
  if (isUniDynamicEngineEnabled()) {
    const rows = await db
      .select({
        id: schema.pillarItems.id,
        title: schema.pillarItems.title,
        parent_item_id: schema.pillarItems.parent_item_id,
        fields: schema.pillarItems.fields,
      })
      .from(schema.pillarItems)
      .innerJoin(schema.pillars, eq(schema.pillars.id, schema.pillarItems.pillar_id))
      .where(and(
        eq(schema.pillars.user_id, uid),
        eq(schema.pillars.key, UNI_TEMPLATE.key),
        eq(schema.pillarItems.is_container, false),
        ilike(schema.pillarItems.title, pattern),
      ))
      .limit(3);

    return Promise.all(
      rows.map(async (a) => ({
        id: a.id,
        title: a.title,
        type: 'assignment' as const,
        href: await dynamicAssignmentHref(a.parent_item_id, typeof a.fields?.legacy_id === 'string' ? a.fields.legacy_id : null),
        meta: 'uni',
      })),
    );
  }

  const rows = await db
    .select({ id: schema.assignments.id, title: schema.assignments.title, subject_id: schema.assignments.subject_id })
    .from(schema.assignments)
    .where(and(eq(schema.assignments.user_id, uid), ilike(schema.assignments.title, pattern)))
    .limit(3);
  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    type: 'assignment' as const,
    href: a.subject_id ? `/uni/${a.subject_id}/${a.id}` : '/uni',
    meta: 'uni',
  }));
}

export async function searchAll(query: string): Promise<SearchResult[]> {
  const user = await requireUser();
  const q = query.trim();
  if (q.length < 2) return [];

  const pattern = `%${q}%`;
  const uid = user.id;

  const [assignments, workblocks, buildItems, clients, fTasks, projects, community] = await Promise.all([
    searchAssignments(uid, pattern),
    db
      .select({ id: schema.workblocks.id, title: schema.workblocks.title, status: schema.workblocks.status })
      .from(schema.workblocks)
      .where(and(eq(schema.workblocks.user_id, uid), ilike(schema.workblocks.title, pattern)))
      .limit(3)
      .then((rows) => rows.map((w) => ({ id: w.id, title: w.title, type: 'workblock' as const, href: `/work/${w.id}`, meta: w.status }))),
    db
      .select({ id: schema.buildItems.id, title: schema.buildItems.title, status: schema.buildItems.status })
      .from(schema.buildItems)
      .where(and(eq(schema.buildItems.user_id, uid), ilike(schema.buildItems.title, pattern)))
      .limit(3)
      .then((rows) => rows.map((b) => ({ id: b.id, title: b.title, type: 'build' as const, href: '/build', meta: b.status }))),
    searchFreelanceClients(uid, pattern),
    searchFreelanceTasks(uid, pattern),
    searchProjects(uid, pattern),
    searchCommunityItems(uid, pattern),
  ]);

  const results: SearchResult[] = [
    ...assignments,
    ...workblocks,
    ...buildItems,
    ...clients,
    ...fTasks,
    ...projects,
    ...community,
  ];

  return results.slice(0, 15);
}
