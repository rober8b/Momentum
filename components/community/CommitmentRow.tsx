'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Circle, Trash2, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatDate, urgencyOf } from '@/lib/date';
import { toggleCommunityDone, deleteCommunityItem, cancelCommunityItem } from '@/app/community/actions';
import { cn } from '@/lib/cn';
import type { CommunityItem } from '@/lib/types';

const URGENCY_BADGE: Record<
  ReturnType<typeof urgencyOf>,
  { variant: 'danger' | 'warning' | 'accent' | 'muted' | 'default'; label: string }
> = {
  overdue: { variant: 'danger', label: 'vencido' },
  today: { variant: 'warning', label: 'hoy' },
  soon: { variant: 'accent', label: 'esta semana' },
  later: { variant: 'muted', label: 'después' },
  none: { variant: 'default', label: 'sin fecha' },
};

export function CommitmentRow({ item, tz = 'UTC' }: { item: CommunityItem; tz?: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(item.status === 'done');
  const urgency = urgencyOf(item.due_date, tz);
  const badge = URGENCY_BADGE[urgency];

  function toggle() {
    startTransition(async () => {
      setDone(!done);
      await toggleCommunityDone(item.id, !done);
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteCommunityItem(item.id);
    });
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-md border border-border bg-surface-elev p-3 transition-opacity',
        done && 'opacity-50',
      )}
    >
      <button
        type="button"
        disabled={isPending}
        onClick={toggle}
        className="shrink-0 mt-0.5 text-muted-foreground hover:text-accent transition-colors"
        aria-label="Toggle done"
      >
        {done ? <CheckCircle2 size={16} className="text-success" /> : <Circle size={16} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium leading-tight', done && 'line-through')}>
          {item.title}
        </p>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
        )}
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <Badge variant="muted">{item.organization}</Badge>
          {!done && (
            <Badge variant={badge.variant}>
              {badge.label}
              {item.due_date && urgency !== 'today' && (
                <span className="ml-1 opacity-75">{formatDate(item.due_date, tz)}</span>
              )}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => {
            startTransition(async () => {
              await cancelCommunityItem(item.id);
            });
          }}
          disabled={isPending || done}
          className="rounded p-1 text-muted-foreground hover:text-warning"
          aria-label="Cancelar"
          title="cancelar"
        >
          <Ban size={12} />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          className="rounded p-1 text-muted-foreground hover:text-danger"
          aria-label="Eliminar"
          title="eliminar"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
