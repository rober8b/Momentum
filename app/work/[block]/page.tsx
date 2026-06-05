import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { db, schema } from '@/lib/db';
import { requireRober } from '@/lib/auth';
import { rowToWorkblock } from '@/lib/today';
import { deleteWorkblock } from '@/app/work/actions';
import { formatDate } from '@/lib/date';

export const dynamic = 'force-dynamic';

export default async function WorkblockDetailPage({
  params,
}: {
  params: Promise<{ block: string }>;
}) {
  await requireRober();
  const { block } = await params;

  const rows = await db
    .select()
    .from(schema.workblocks)
    .where(eq(schema.workblocks.id, block))
    .limit(1);

  if (!rows.length) notFound();
  const workblock = rowToWorkblock(rows[0]);

  async function handleDelete() {
    'use server';
    await deleteWorkblock(block);
  }

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-3xl">
      <Link
        href="/work"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent mb-6"
      >
        <ArrowLeft size={12} /> kanban
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant="default">{workblock.type}</Badge>
            <Badge variant={workblock.priority === 'high' ? 'danger' : workblock.priority === 'med' ? 'warning' : 'muted'}>
              {workblock.priority}
            </Badge>
            <Badge variant="accent">{workblock.status}</Badge>
            {workblock.due_date && <Badge variant="warning">due {formatDate(workblock.due_date)}</Badge>}
          </div>
          <h1 className="text-2xl font-semibold leading-tight">{workblock.title}</h1>
        </div>
        <form action={handleDelete}>
          <Button type="submit" variant="ghost" size="sm" aria-label="Delete">
            <Trash2 size={14} />
          </Button>
        </form>
      </div>

      {workblock.description && (
        <Card className="mb-4">
          <CardHeader><CardTitle>descripción</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{workblock.description}</CardContent>
        </Card>
      )}

      {workblock.notes && (
        <Card className="mb-4">
          <CardHeader><CardTitle>notas</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap font-mono">{workblock.notes}</CardContent>
        </Card>
      )}

      {Object.keys(workblock.links).length > 0 && (
        <Card className="mb-4">
          <CardHeader><CardTitle>links</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {Object.entries(workblock.links).map(([key, url]) => (
                <li key={key}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
                    {key} → {url}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>meta</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1 font-mono">
          <div>created: {new Date(workblock.created_at).toLocaleString('es-AR')}</div>
          {workblock.completed_at && (
            <div>completed: {new Date(workblock.completed_at).toLocaleString('es-AR')}</div>
          )}
          <div>client: {workblock.client}</div>
        </CardContent>
      </Card>
    </div>
  );
}
