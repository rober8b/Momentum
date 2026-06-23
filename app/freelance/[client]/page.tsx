import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, eq, asc, desc, ne, or, sql } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Pagination';
import { TaskForm } from '@/components/freelance/TaskForm';
import { FreelanceTaskCard } from '@/components/freelance/FreelanceTaskCard';
import { ClientEditForm } from '@/components/freelance/ClientEditForm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rowToFreelanceClient, rowToFreelanceTask } from '@/lib/today';
import { isFreelanceDynamicEngineEnabled } from '@/lib/pillar-flags';
import { rowToPillar, rowToPillarItem } from '@/lib/pillars';
import { PillarContainerPageContent } from '@/components/pillars/PillarContainerPageContent';
import { FREELANCE_TEMPLATE } from '@/lib/pillar-templates';
import type { FreelanceTaskStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DONE_PAGE_SIZE = 30;

const STATUS_COLUMNS: { id: FreelanceTaskStatus; label: string; tone: string }[] = [
  { id: 'backlog', label: 'backlog', tone: 'text-muted-foreground' },
  { id: 'today', label: 'hoy', tone: 'text-foreground' },
  { id: 'in-progress', label: 'in progress', tone: 'text-accent' },
  { id: 'blocked', label: 'blocked', tone: 'text-warning' },
  { id: 'done', label: 'done', tone: 'text-success' },
];

const CLIENT_STATUS_BADGE: Record<string, { variant: 'accent' | 'warning' | 'danger' | 'muted' }> = {
  active: { variant: 'accent' },
  paused: { variant: 'warning' },
  blocked: { variant: 'danger' },
  archived: { variant: 'muted' },
};

export default async function FreelanceClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ client: string }>;
  searchParams: Promise<{ donePage?: string }>;
}) {
  const user = await requireUser();
  const { client: clientId } = await params;

  // Rollback flag — see docs/DYNAMIC_PILLARS.md and lib/pillar-flags.ts.
  if (isFreelanceDynamicEngineEnabled()) {
    return <DynamicFreelanceClientPage userId={user.id} clientParam={clientId} />;
  }

  const { donePage: donePageParam } = await searchParams;
  const donePage = Math.max(1, Number.parseInt(donePageParam ?? '1', 10) || 1);
  const doneOffset = (donePage - 1) * DONE_PAGE_SIZE;

  const [clientRows, activeTaskRows, doneTaskRows, [{ count: doneCount }]] = await Promise.all([
    db.select().from(schema.freelanceClients).where(and(eq(schema.freelanceClients.id, clientId), eq(schema.freelanceClients.user_id, user.id))).limit(1),
    db
      .select()
      .from(schema.freelanceTasks)
      .where(and(eq(schema.freelanceTasks.client_id, clientId), eq(schema.freelanceTasks.user_id, user.id), ne(schema.freelanceTasks.status, 'done')))
      .orderBy(asc(schema.freelanceTasks.created_at)),
    db
      .select()
      .from(schema.freelanceTasks)
      .where(and(eq(schema.freelanceTasks.client_id, clientId), eq(schema.freelanceTasks.user_id, user.id), eq(schema.freelanceTasks.status, 'done')))
      .orderBy(desc(schema.freelanceTasks.created_at))
      .limit(DONE_PAGE_SIZE)
      .offset(doneOffset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.freelanceTasks)
      .where(and(eq(schema.freelanceTasks.client_id, clientId), eq(schema.freelanceTasks.user_id, user.id), eq(schema.freelanceTasks.status, 'done'))),
  ]);

  if (!clientRows.length) notFound();

  const client = rowToFreelanceClient(clientRows[0]);
  const tasks = [...activeTaskRows, ...doneTaskRows].map(rowToFreelanceTask);
  const doneTotalPages = Math.max(1, Math.ceil(doneCount / DONE_PAGE_SIZE));

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-[1400px]">
      <Link
        href="/freelance"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent mb-6"
      >
        <ArrowLeft size={12} /> clientes
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant={CLIENT_STATUS_BADGE[client.status].variant}>{client.status}</Badge>
            {client.stack && (
              <span className="text-xs text-muted-foreground font-mono">{client.stack}</span>
            )}
          </div>
          <h1 className="text-2xl lg:text-3xl font-semibold">{client.name}</h1>
          {client.description && (
            <p className="text-sm text-muted-foreground mt-1">{client.description}</p>
          )}
        </div>
        <ClientEditForm client={client} />
      </div>

      {(client.next_step || client.last_update) && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {client.next_step && (
            <Card>
              <CardHeader><CardTitle>próximo paso</CardTitle></CardHeader>
              <CardContent className="text-sm">{client.next_step}</CardContent>
            </Card>
          )}
          {client.last_update && (
            <Card>
              <CardHeader><CardTitle>último avance</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{client.last_update}</CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {STATUS_COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          const isDone = col.id === 'done';
          return (
            <div key={col.id} className="flex flex-col gap-3 min-w-0">
              <div className="flex items-center justify-between gap-2 px-1">
                <h3 className={`text-xs font-semibold uppercase tracking-wider ${col.tone}`}>
                  {col.label}
                </h3>
                <span className="text-xs text-muted-foreground font-mono">{isDone ? doneCount : colTasks.length}</span>
              </div>
              <div className="space-y-2 min-h-[80px]">
                {colTasks.map((task) => (
                  <FreelanceTaskCard key={task.id} task={task} />
                ))}
                <TaskForm clientId={clientId} defaultStatus={col.id} />
              </div>
              {isDone && (
                <Pagination basePath={`/freelance/${clientId}`} page={donePage} totalPages={doneTotalPages} paramName="donePage" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Dynamic-engine path. The URL param can be either a pillar_items id (a
// client created after cutover) or the original freelance_clients.id (a
// bookmarked pre-cutover URL) — matching on fields.legacy_id keeps old
// links working permanently without a redirect table. See
// docs/DYNAMIC_PILLARS.md.
async function DynamicFreelanceClientPage({ userId, clientParam }: { userId: string; clientParam: string }) {
  const [pillarRow] = await db
    .select()
    .from(schema.pillars)
    .where(and(eq(schema.pillars.user_id, userId), eq(schema.pillars.key, FREELANCE_TEMPLATE.key)))
    .limit(1);
  if (!pillarRow) notFound();
  const pillar = rowToPillar(pillarRow);

  const [containerRow] = await db
    .select()
    .from(schema.pillarItems)
    .where(and(
      eq(schema.pillarItems.pillar_id, pillar.id),
      eq(schema.pillarItems.user_id, userId),
      eq(schema.pillarItems.is_container, true),
      or(
        eq(schema.pillarItems.id, clientParam),
        sql`${schema.pillarItems.fields}->>'legacy_id' = ${clientParam}`,
      ),
    ))
    .limit(1);
  if (!containerRow) notFound();
  const container = rowToPillarItem(containerRow);

  const childRows = await db
    .select()
    .from(schema.pillarItems)
    .where(and(eq(schema.pillarItems.parent_item_id, container.id), eq(schema.pillarItems.user_id, userId)))
    .orderBy(schema.pillarItems.position, schema.pillarItems.created_at);
  const children = childRows.map(rowToPillarItem);

  return (
    <PillarContainerPageContent
      pillar={pillar}
      container={container}
      children={children}
      basePath="/freelance"
      childLabel="nueva tarea"
    />
  );
}
