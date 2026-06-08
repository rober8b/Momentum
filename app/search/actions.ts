'use server';

import { and, eq, ilike } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export type SearchResult = {
  id: string;
  title: string;
  type: 'assignment' | 'workblock' | 'build' | 'freelance-client' | 'freelance-task' | 'project' | 'community';
  href: string;
  meta?: string;
};

export async function searchAll(query: string): Promise<SearchResult[]> {
  const user = await requireUser();
  const q = query.trim();
  if (q.length < 2) return [];

  const pattern = `%${q}%`;
  const uid = user.id;

  const [assignments, workblocks, buildItems, clients, fTasks, projects, community] =
    await Promise.all([
      db
        .select({ id: schema.assignments.id, title: schema.assignments.title, subject_id: schema.assignments.subject_id })
        .from(schema.assignments)
        .where(and(eq(schema.assignments.user_id, uid), ilike(schema.assignments.title, pattern)))
        .limit(3),
      db
        .select({ id: schema.workblocks.id, title: schema.workblocks.title, status: schema.workblocks.status })
        .from(schema.workblocks)
        .where(and(eq(schema.workblocks.user_id, uid), ilike(schema.workblocks.title, pattern)))
        .limit(3),
      db
        .select({ id: schema.buildItems.id, title: schema.buildItems.title, status: schema.buildItems.status })
        .from(schema.buildItems)
        .where(and(eq(schema.buildItems.user_id, uid), ilike(schema.buildItems.title, pattern)))
        .limit(3),
      db
        .select({ id: schema.freelanceClients.id, name: schema.freelanceClients.name })
        .from(schema.freelanceClients)
        .where(and(eq(schema.freelanceClients.user_id, uid), ilike(schema.freelanceClients.name, pattern)))
        .limit(3),
      db
        .select({ id: schema.freelanceTasks.id, title: schema.freelanceTasks.title, client_id: schema.freelanceTasks.client_id })
        .from(schema.freelanceTasks)
        .where(and(eq(schema.freelanceTasks.user_id, uid), ilike(schema.freelanceTasks.title, pattern)))
        .limit(3),
      db
        .select({ id: schema.ownProjects.id, name: schema.ownProjects.name })
        .from(schema.ownProjects)
        .where(and(eq(schema.ownProjects.user_id, uid), ilike(schema.ownProjects.name, pattern)))
        .limit(3),
      db
        .select({ id: schema.communityItems.id, title: schema.communityItems.title, organization: schema.communityItems.organization })
        .from(schema.communityItems)
        .where(and(eq(schema.communityItems.user_id, uid), ilike(schema.communityItems.title, pattern)))
        .limit(3),
    ]);

  const results: SearchResult[] = [
    ...assignments.map((a) => ({
      id: a.id,
      title: a.title,
      type: 'assignment' as const,
      href: a.subject_id ? `/uni/${a.subject_id}/${a.id}` : '/uni',
      meta: 'uni',
    })),
    ...workblocks.map((w) => ({
      id: w.id,
      title: w.title,
      type: 'workblock' as const,
      href: `/work/${w.id}`,
      meta: w.status,
    })),
    ...buildItems.map((b) => ({
      id: b.id,
      title: b.title,
      type: 'build' as const,
      href: '/build',
      meta: b.status,
    })),
    ...clients.map((c) => ({
      id: c.id,
      title: c.name,
      type: 'freelance-client' as const,
      href: `/freelance/${c.id}`,
      meta: 'cliente',
    })),
    ...fTasks.map((t) => ({
      id: t.id,
      title: t.title,
      type: 'freelance-task' as const,
      href: t.client_id ? `/freelance/${t.client_id}` : '/freelance',
      meta: 'tarea freelance',
    })),
    ...projects.map((p) => ({
      id: p.id,
      title: p.name,
      type: 'project' as const,
      href: '/projects',
      meta: 'proyecto',
    })),
    ...community.map((c) => ({
      id: c.id,
      title: c.title,
      type: 'community' as const,
      href: '/community',
      meta: c.organization,
    })),
  ];

  return results.slice(0, 15);
}
