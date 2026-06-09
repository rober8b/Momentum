'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatDate, urgencyOf } from '@/lib/date';
import { toggleAssignmentDone } from '@/app/uni/actions';
import { cn } from '@/lib/cn';
import { t } from '@/lib/strings';
import type { Assignment } from '@/lib/types';
import type { Lang } from '@/lib/strings';

type Props = {
  assignment: Assignment & { subjectName: string | null };
  tz?: string;
  lang?: Lang;
};

function getUrgencyBadge(lang: Lang): Record<
  ReturnType<typeof urgencyOf>,
  { variant: 'danger' | 'warning' | 'accent' | 'muted' | 'default'; label: string }
> {
  return {
    overdue: { variant: 'danger', label: t('urgencyOverdue', lang) },
    today: { variant: 'warning', label: t('urgencyToday', lang) },
    soon: { variant: 'accent', label: t('urgencySoon', lang) },
    later: { variant: 'muted', label: t('urgencyLater', lang) },
    none: { variant: 'default', label: t('urgencyNone', lang) },
  };
}

export function AssignmentRow({ assignment, tz = 'UTC', lang = 'en' }: Props) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(assignment.status === 'done');
  const urgency = urgencyOf(assignment.due_date, tz);
  const badge = getUrgencyBadge(lang)[urgency];

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
