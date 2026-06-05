'use client';

import { useTransition, useState } from 'react';
import Link from 'next/link';
import { Flame, Pause, Play, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { updateWorkblockStatus } from '@/app/work/actions';
import { cn } from '@/lib/cn';
import type { Workblock } from '@/lib/types';

const PRIORITY_VARIANT = {
  high: { variant: 'danger' as const, icon: Flame },
  med: { variant: 'warning' as const, icon: null },
  low: { variant: 'muted' as const, icon: null },
};

const STATUS_LABEL: Record<Workblock['status'], string> = {
  backlog: 'backlog',
  today: 'hoy',
  'in-progress': 'in progress',
  blocked: 'blocked',
  done: 'done',
};

export function TicketCard({ workblock }: { workblock: Workblock }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(workblock.status);
  const priority = PRIORITY_VARIANT[workblock.priority];
  const Icon = priority.icon;

  function advance(next: Workblock['status']) {
    startTransition(async () => {
      setStatus(next);
      await updateWorkblockStatus(workblock.id, next);
    });
  }

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-surface-elev p-3',
        status === 'done' && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/work/${workblock.id}`}
          className="text-sm font-medium leading-tight hover:text-accent transition-colors min-w-0"
        >
          {workblock.title}
        </Link>
        <Badge variant={priority.variant}>
          {Icon && <Icon size={10} />}
          {workblock.priority}
        </Badge>
      </div>
      {workblock.description && (
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
          {workblock.description}
        </p>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <Badge variant="default">{STATUS_LABEL[status]}</Badge>
        <div className="flex items-center gap-1">
          {status !== 'in-progress' && status !== 'done' && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => advance('in-progress')}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Start"
              title="Start"
            >
              <Play size={12} />
            </button>
          )}
          {status === 'in-progress' && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => advance('blocked')}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Block"
              title="Block"
            >
              <Pause size={12} />
            </button>
          )}
          {status !== 'done' && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => advance('done')}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-success transition-colors"
              aria-label="Done"
              title="Done"
            >
              <CheckCircle2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
