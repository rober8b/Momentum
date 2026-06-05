import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, asc } from 'drizzle-orm';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { TaskForm } from '@/components/freelance/TaskForm';
import { db, schema } from '@/lib/db';
import { requireRober } from '@/lib/auth';
import { rowToFreelanceClient, rowToFreelanceTask } from '@/lib/today';
import { deleteClient, updateFreelanceTaskStatus } from '@/app/freelance/actions';
import type { FreelanceTaskStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

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
}: {
  params: Promise<{ client: string }>;
}) {
  await requireRober();
  const { client: clientId } = await params;

  const [clientRows, taskRows] = await Promise.all([
    db.select().from(schema.freelanceClients).where(eq(schema.freelanceClients.id, clientId)).limit(1),
    db.select().from(schema.freelanceTasks).where(eq(schema.freelanceTasks.client_id, clientId)).orderBy(asc(schema.freelanceTasks.created_at)),
  ]);

  if (!clientRows.length) notFound();

  const client = rowToFreelanceClient(clientRows[0]);
  const tasks = taskRows.map(rowToFreelanceTask);

  async function handleDelete() {
    'use server';
    await deleteClient(clientId);
  }

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
        <form action={handleDelete}>
          <Button type="submit" variant="ghost" size="sm" aria-label="Eliminar cliente">
            <Trash2 size={14} />
          </Button>
        </form>
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
          return (
            <div key={col.id} className="flex flex-col gap-3 min-w-0">
              <div className="flex items-center justify-between gap-2 px-1">
                <h3 className={`text-xs font-semibold uppercase tracking-wider ${col.tone}`}>
                  {col.label}
                </h3>
                <span className="text-xs text-muted-foreground font-mono">{colTasks.length}</span>
              </div>
              <div className="space-y-2 min-h-[80px]">
                {colTasks.map((task) => (
                  <FreelanceTaskCard key={task.id} task={task} />
                ))}
                <TaskForm clientId={clientId} defaultStatus={col.id} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FreelanceTaskCard({ task }: { task: ReturnType<typeof rowToFreelanceTask> }) {
  const FLOW: FreelanceTaskStatus[] = ['backlog', 'today', 'in-progress', 'blocked', 'done'];
  const currentIdx = FLOW.indexOf(task.status);
  const next = currentIdx < FLOW.length - 1 ? FLOW[currentIdx + 1] : null;
  const prev = currentIdx > 0 ? FLOW[currentIdx - 1] : null;

  async function moveForward() {
    'use server';
    if (next) await updateFreelanceTaskStatus(task.id, next);
  }

  async function moveBack() {
    'use server';
    if (prev) await updateFreelanceTaskStatus(task.id, prev);
  }

  return (
    <div className="group rounded-md border border-border bg-surface-elev p-2.5">
      <p className="text-sm font-medium leading-tight">{task.title}</p>
      <div className="mt-2 flex items-center justify-between gap-1">
        <Badge
          variant={
            task.priority === 'high' ? 'danger' : task.priority === 'med' ? 'warning' : 'muted'
          }
        >
          {task.priority}
        </Badge>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {prev && (
            <form action={moveBack}>
              <button
                type="submit"
                className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                title={`← ${prev}`}
              >
                ←
              </button>
            </form>
          )}
          {next && (
            <form action={moveForward}>
              <button
                type="submit"
                className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                title={`${next} →`}
              >
                →
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
