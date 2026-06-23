import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import { FolderOpen, Layers } from 'lucide-react';
import { ClientCard } from '@/components/freelance/ClientCard';
import { ClientForm } from '@/components/freelance/ClientForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { t } from '@/lib/strings';
import { rowToFreelanceClient, rowToFreelanceTask } from '@/lib/today';
import { getLastPush, formatPush } from '@/lib/github';
import { isFreelanceDynamicEngineEnabled } from '@/lib/pillar-flags';
import { rowToPillar, rowToPillarItem } from '@/lib/pillars';
import { PillarPageContent } from '@/components/pillars/PillarPageContent';
import { InstantiateTemplateButton } from '@/components/pillars/InstantiateTemplateButton';
import { FREELANCE_TEMPLATE } from '@/lib/pillar-templates';

export const dynamic = 'force-dynamic';

const ARCHIVED_PAGE_SIZE = 24;

export default async function FreelancePage({
  searchParams,
}: {
  searchParams: Promise<{ archPage?: string }>;
}) {
  const user = await requireUser();

  // Rollback flag — see docs/DYNAMIC_PILLARS.md and lib/pillar-flags.ts.
  // Set FREELANCE_DYNAMIC_ENGINE=false to fall back to the path below
  // instantly. freelance_clients/freelance_tasks are never touched by the
  // dynamic path, so flipping this back and forth is always safe.
  if (isFreelanceDynamicEngineEnabled()) {
    return <DynamicFreelancePage userId={user.id} />;
  }

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

// Dynamic-engine path: reads from pillars/pillar_items (clients as
// containers, tasks as their children) instead of
// freelance_clients/freelance_tasks. See docs/DYNAMIC_PILLARS.md.
async function DynamicFreelancePage({ userId }: { userId: string }) {
  const [pillarRow] = await db
    .select()
    .from(schema.pillars)
    .where(and(eq(schema.pillars.user_id, userId), eq(schema.pillars.key, FREELANCE_TEMPLATE.key)))
    .limit(1);

  if (!pillarRow) {
    return (
      <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-7xl">
        <div className="mb-6 lg:mb-8">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">freelance</p>
          <h2 className="text-2xl lg:text-3xl font-semibold mt-1">clientes</h2>
        </div>
        <EmptyState
          icon={Layers}
          title="este pilar todavía no está activado"
          description="instanciá el template de freelance para empezar a usar el motor dinámico."
          action={<InstantiateTemplateButton template={FREELANCE_TEMPLATE} />}
        />
      </div>
    );
  }

  const pillar = rowToPillar(pillarRow);
  const itemRows = await db
    .select()
    .from(schema.pillarItems)
    .where(and(
      eq(schema.pillarItems.user_id, userId),
      eq(schema.pillarItems.pillar_id, pillar.id),
      isNull(schema.pillarItems.parent_item_id),
    ))
    .orderBy(schema.pillarItems.position, schema.pillarItems.created_at);
  const items = itemRows.map(rowToPillarItem);

  return <PillarPageContent pillar={pillar} items={items} eyebrow="freelance" basePath="/freelance" itemLabel="nuevo cliente" />;
}
