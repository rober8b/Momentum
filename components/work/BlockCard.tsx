'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { Flame, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { updateWorkblockStatus } from '@/app/work/actions';
import { formatDate } from '@/lib/date';
import { cn } from '@/lib/cn';
import type { Workblock, WorkblockStatus } from '@/lib/types';

const FLOW: WorkblockStatus[] = ['backlog', 'today', 'in-progress', 'blocked', 'done'];

const PRIORITY = {
  high: { variant: 'danger' as const, icon: Flame },
  med: { variant: 'warning' as const, icon: null },
  low: { variant: 'muted' as const, icon: null },
};

export function BlockCard({ workblock }: { workblock: Workblock }) {
  const [isPending, startTransition] = useTransition();
  const p = PRIORITY[workblock.priority];
  const Icon = p.icon;
  const currentIdx = FLOW.indexOf(workblock.status);
  const prev = currentIdx > 0 ? FLOW[currentIdx - 1] : null;
  const next = currentIdx < FLOW.length - 1 ? FLOW[currentIdx + 1] : null;

  function move(target: WorkblockStatus) {
    startTransition(async () => {
      await updateWorkblockStatus(workblock.id, target);
    });
  }

  return (
    <div
      className={cn(
        'group rounded-md border border-border bg-surface-elev p-3 transition-shadow hover:shadow-md',
        workblock.status === 'done' && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/work/${workblock.id}`}
          className="text-sm font-medium leading-tight hover:text-accent transition-colors min-w-0 flex-1"
        >
          {workblock.title}
        </Link>
        <Badge variant={p.variant}>
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
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
          <span>{workblock.type}</span>
          {workblock.due_date && <span>· {formatDate(workblock.due_date)}</span>}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {prev && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => move(prev)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Move to ${prev}`}
              title={`← ${prev}`}
            >
              <ChevronLeft size={12} />
            </button>
          )}
          {next && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => move(next)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Move to ${next}`}
              title={`${next} →`}
            >
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>

      {Object.keys(workblock.links).length > 0 && (
        <div className="mt-2 flex gap-2 flex-wrap">
          {Object.entries(workblock.links).map(([key, url]) => (
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-accent"
            >
              <ExternalLink size={10} />
              {key}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
