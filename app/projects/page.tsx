import { asc, eq } from 'drizzle-orm';
import { Rocket } from 'lucide-react';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { t } from '@/lib/strings';
import { rowToOwnProject } from '@/lib/today';
import { getLastPush, formatPush } from '@/lib/github';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(schema.ownProjects)
    .where(eq(schema.ownProjects.user_id, user.id))
    .orderBy(asc(schema.ownProjects.created_at));

  const projects = rows.map(rowToOwnProject);

  const pushMap = Object.fromEntries(
    await Promise.all(
      projects.map(async (p) => [p.id, formatPush(await getLastPush(p.links.repo))])
    )
  );

  const active = projects.filter((p) => p.status !== 'archived');
  const archived = projects.filter((p) => p.status === 'archived');

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

      {archived.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-3">
            archivados ({archived.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archived.map((p) => (
              <ProjectCard key={p.id} project={p} lastPush={pushMap[p.id]} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
