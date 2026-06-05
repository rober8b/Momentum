'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { FreelanceClient, FreelanceTask } from '@/lib/types';

const STATUS_BADGE: Record<FreelanceClient['status'], { variant: 'accent' | 'warning' | 'danger' | 'muted'; label: string }> = {
  active: { variant: 'accent', label: 'activo' },
  paused: { variant: 'muted', label: 'pausado' },
  blocked: { variant: 'danger', label: 'bloqueado' },
  archived: { variant: 'muted', label: 'archivado' },
};

export function ClientCard({
  client,
  tasks,
}: {
  client: FreelanceClient;
  tasks: FreelanceTask[];
}) {
  const badge = STATUS_BADGE[client.status];
  const activeTasks = tasks.filter((t) => t.status !== 'done');

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-surface-elev p-4 flex flex-col gap-3',
        client.status === 'archived' && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {client.stack && (
              <span className="text-[10px] text-muted-foreground font-mono">{client.stack}</span>
            )}
          </div>
          <h3 className="text-sm font-semibold leading-tight">{client.name}</h3>
        </div>
        <Link
          href={`/freelance/${client.id}`}
          className="shrink-0 text-muted-foreground hover:text-accent transition-colors"
          title="Ver detalle"
        >
          <ArrowRight size={14} />
        </Link>
      </div>

      {client.next_step && (
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground font-medium">→</span> {client.next_step}
        </p>
      )}

      {activeTasks.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {activeTasks.length} tarea{activeTasks.length !== 1 ? 's' : ''} activa{activeTasks.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
