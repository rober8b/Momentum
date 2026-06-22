import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { Rocket } from 'lucide-react';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { t } from '@/lib/strings';
import { rowToOwnProject } from '@/lib/today';
import { getLastPush, formatPush } from '@/lib/github';

export const dynamic = 'force-dynamic';

const ARCHIVED_PAGE_SIZE = 24;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archPage?: string }>;
}) {
  const user = await requireUser();
  const { archPage: archPageParam } = await searchParams;
  const archPage = Math.max(1, Number.parseInt(archPageParam ?? '1', 10) || 1);
  const archOffset = (archPage - 1) * ARCHIVED_PAGE_SIZE;

  const [activeRows, archivedRows, [{ count: archivedCount }]] = await Promise.all([
    db
      .select()
      .from(schema.ownProjects)
      .where(and(eq(schema.ownProjects.user_id, user.id), ne(schema.ownProjects.status, 'archived')))
      .orderBy(asc(schema.ownProjects.created_at)),
    db
      .select()
      .from(schema.ownProjects)
      .where(and(eq(schema.ownProjects.user_id, user.id), eq(schema.ownProjects.status, 'archived')))
      .orderBy(asc(schema.ownProjects.created_at))
      .limit(ARCHIVED_PAGE_SIZE)
      .offset(archOffset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.ownProjects)
      .where(and(eq(schema.ownProjects.user_id, user.id), eq(schema.ownProjects.status, 'archived'))),
  ]);

  const active = activeRows.map(rowToOwnProject);
  const archived = archivedRows.map(rowToOwnProject);
  const archTotalPages = Math.max(1, Math.ceil(archivedCount / ARCHIVED_PAGE_SIZE));

  const pushMap = Object.fromEntries(
    await Promise.all(
      [...active, ...archived].map(async (p) => [p.id, formatPush(await getLastPush(p.links.repo))])
    )
  );

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-7xl">
      <div className="mb-6 lg:mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            proyectos propios
          </p>
          <h2 className="text-2xl lg:text-3xl font-semibold mt-1">proyectos</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {active.filter((p) => p.status === 'active').length} activos · {active.filter((p) => p.status === 'blocked').length} bloqueados
          </p>
        </div>
        <ProjectForm />
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title={t('projectsNoProjects', user.settings.language)}
          description={t('projectsNoProjectsHint', user.settings.language)}
          action={<ProjectForm />}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {active.map((p) => (
            <ProjectCard key={p.id} project={p} lastPush={pushMap[p.id]} />
          ))}
        </div>
      )}

      {archivedCount > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-3">
            archivados ({archivedCount})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archived.map((p) => (
              <ProjectCard key={p.id} project={p} lastPush={pushMap[p.id]} />
            ))}
          </div>
          <Pagination basePath="/projects" page={archPage} totalPages={archTotalPages} paramName="archPage" />
        </div>
      )}
    </div>
  );
}
