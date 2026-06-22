import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { FolderOpen } from 'lucide-react';
import { ClientCard } from '@/components/freelance/ClientCard';
import { ClientForm } from '@/components/freelance/ClientForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { t } from '@/lib/strings';
import { rowToFreelanceClient, rowToFreelanceTask } from '@/lib/today';
import { getLastPush, formatPush } from '@/lib/github';

export const dynamic = 'force-dynamic';

const ARCHIVED_PAGE_SIZE = 24;

export default async function FreelancePage({
  searchParams,
}: {
  searchParams: Promise<{ archPage?: string }>;
}) {
  const user = await requireUser();
  const { archPage: archPageParam } = await searchParams;
  const archPage = Math.max(1, Number.parseInt(archPageParam ?? '1', 10) || 1);
  const archOffset = (archPage - 1) * ARCHIVED_PAGE_SIZE;

  const [activeClientRows, archivedClientRows, [{ count: archivedCount }], taskRows] = await Promise.all([
    db
      .select()
      .from(schema.freelanceClients)
      .where(and(eq(schema.freelanceClients.user_id, user.id), ne(schema.freelanceClients.status, 'archived')))
      .orderBy(asc(schema.freelanceClients.name)),
    db
      .select()
      .from(schema.freelanceClients)
      .where(and(eq(schema.freelanceClients.user_id, user.id), eq(schema.freelanceClients.status, 'archived')))
      .orderBy(asc(schema.freelanceClients.name))
      .limit(ARCHIVED_PAGE_SIZE)
      .offset(archOffset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.freelanceClients)
      .where(and(eq(schema.freelanceClients.user_id, user.id), eq(schema.freelanceClients.status, 'archived'))),
    // ClientCard only displays the count of active (non-done) tasks per client, so done tasks aren't fetched here.
    db.select().from(schema.freelanceTasks).where(and(eq(schema.freelanceTasks.user_id, user.id), ne(schema.freelanceTasks.status, 'done'))),
  ]);

  const active = activeClientRows.map(rowToFreelanceClient);
  const archived = archivedClientRows.map(rowToFreelanceClient);
  const tasks = taskRows.map(rowToFreelanceTask);
  const archTotalPages = Math.max(1, Math.ceil(archivedCount / ARCHIVED_PAGE_SIZE));

  const pushMap = Object.fromEntries(
    await Promise.all(
      [...active, ...archived].map(async (c) => [c.id, formatPush(await getLastPush(c.links.repo))])
    )
  );

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-7xl">
      <div className="mb-6 lg:mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            freelance
          </p>
          <h2 className="text-2xl lg:text-3xl font-semibold mt-1">clientes</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {active.length} activos · {tasks.length} tareas pendientes
          </p>
        </div>
        <ClientForm />
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={t('freelanceNoClients', user.settings.language)}
          description={t('freelanceNoClientsHint', user.settings.language)}
          action={<ClientForm />}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {active.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              tasks={tasks.filter((t) => t.client_id === c.id)}
              lastPush={pushMap[c.id]}
            />
          ))}
        </div>
      )}

      {archivedCount > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-3">
            archivados ({archivedCount})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archived.map((c) => (
              <ClientCard
                key={c.id}
                client={c}
                tasks={tasks.filter((t) => t.client_id === c.id)}
                lastPush={pushMap[c.id]}
              />
            ))}
          </div>
          <Pagination basePath="/freelance" page={archPage} totalPages={archTotalPages} paramName="archPage" />
        </div>
      )}
    </div>
  );
}
