'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatDate, urgencyOf } from '@/lib/date';
import { toggleAssignmentDone } from '@/app/uni/actions';
import { cn } from '@/lib/cn';
import type { Assignment } from '@/lib/types';

type Props = {
  assignment: Assignment & { subjectName: string | null };
  tz?: string;
};

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

export function AssignmentRow({ assignment, tz = 'UTC' }: Props) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(assignment.status === 'done');
  const urgency = urgencyOf(assignment.due_date, tz);
  const badge = URGENCY_BADGE[urgency];

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md border border-border bg-surface-elev p-3 transition-opacity',
        done && 'opacity-50',
      )}
    >
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const next = !done;
            setDone(next);
            await toggleAssignmentDone(assignment.id, next);
          })
        }
        className="shrink-0 mt-0.5 text-muted-foreground hover:text-accent transition-colors"
        aria-label="Mark as done"
      >
        {done ? <CheckCircle2 size={16} className="text-success" /> : <Circle size={16} />}
      </button>
      <div className="min-w-0 flex-1">
        {assignment.subject_id ? (
          <Link
            href={`/uni/${assignment.subject_id}/${assignment.id}`}
            className={cn('text-sm font-medium leading-tight truncate block hover:text-accent transition-colors', done && 'line-through')}
          >
            {assignment.title}
            <ArrowRight size={10} className="inline ml-1 opacity-50" />
          </Link>
        ) : (
          <p className={cn('text-sm font-medium leading-tight truncate', done && 'line-through')}>
            {assignment.title}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {assignment.subjectName && (
            <span className="text-xs text-muted-foreground">{assignment.subjectName}</span>
          )}
          <Badge variant={badge.variant}>
            {badge.label}
            {assignment.due_date && urgency !== 'today' && (
              <span className="ml-1 opacity-75">{formatDate(assignment.due_date, tz)}</span>
            )}
          </Badge>
        </div>
      </div>
    </div>
  );
}
