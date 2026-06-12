import { asc, eq } from 'drizzle-orm';
import { FolderOpen } from 'lucide-react';
import { ClientCard } from '@/components/freelance/ClientCard';
import { ClientForm } from '@/components/freelance/ClientForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { t } from '@/lib/strings';
import { rowToFreelanceClient, rowToFreelanceTask } from '@/lib/today';
import { getLastPush, formatPush } from '@/lib/github';

export const dynamic = 'force-dynamic';

export default async function FreelancePage() {
  const user = await requireUser();

  const [clientRows, taskRows] = await Promise.all([
    db.select().from(schema.freelanceClients).where(eq(schema.freelanceClients.user_id, user.id)).orderBy(asc(schema.freelanceClients.name)),
    db.select().from(schema.freelanceTasks).where(eq(schema.freelanceTasks.user_id, user.id)),
  ]);

  const clients = clientRows.map(rowToFreelanceClient);
  const tasks = taskRows.map(rowToFreelanceTask);

  const pushMap = Object.fromEntries(
    await Promise.all(
      clients.map(async (c) => [c.id, formatPush(await getLastPush(c.links.repo))])
    )
  );

  const active = clients.filter((c) => c.status !== 'archived');
  const archived = clients.filter((c) => c.status === 'archived');

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-7xl">
      <div className="mb-6 lg:mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            freelance
          </p>
          <h2 className="text-2xl lg:text-3xl font-semibold mt-1">clientes</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {active.length} activos · {tasks.filter((t) => t.status !== 'done').length} tareas pendientes
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

      {archived.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-3">
            archivados ({archived.length})
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
        </div>
      )}
    </div>
  );
}
