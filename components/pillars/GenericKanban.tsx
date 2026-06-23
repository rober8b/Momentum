'use client';

import { useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { updatePillarItemStatus, deletePillarItem } from '@/app/p/actions';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/hooks/useToast';
import { readCardField } from './pillar-render-utils';
import type { PillarItem, PillarStatusStep } from '@/lib/types';

// Mirrors components/work/BlockCard.tsx's prev/next chevron interaction —
// the existing kanban interaction language in this codebase (no
// drag-and-drop, per CLAUDE.md). Buttons move an item exactly one column
// left/right along the workflow.
function ItemCard({ item, workflow, cardFields }: { item: PillarItem; workflow: PillarStatusStep[]; cardFields: string[] }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(item.status);
  const toast = useToast();
  const idx = workflow.findIndex((s) => s.key === status);
  const prevStep = idx > 0 ? workflow[idx - 1] : null;
  const nextStep = idx >= 0 && idx < workflow.length - 1 ? workflow[idx + 1] : null;

  function move(target: string) {
    const prev = status;
    startTransition(async () => {
      setStatus(target);
      const result = await updatePillarItemStatus(item.id, target);
      if (!result.ok) {
        setStatus(prev);
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deletePillarItem(item.id);
    });
  }

  return (
    <div className={cn('rounded-md border border-border bg-surface-elev p-3', isPending && 'opacity-50')}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight flex-1 min-w-0">{item.title}</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="shrink-0 text-muted-foreground hover:text-danger transition-colors p-1"
          aria-label="eliminar"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {cardFields
        .map((f) => readCardField(item, f))
        .filter((text): text is string => Boolean(text))
        .map((text, i) => (
          <p key={i} className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {text}
          </p>
        ))}

      <div className="mt-2 flex items-center justify-end gap-0.5">
        {prevStep && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => move(prevStep.key)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`mover a ${prevStep.label}`}
            title={`← ${prevStep.label}`}
          >
            <ChevronLeft size={12} />
          </button>
        )}
        {nextStep && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => move(nextStep.key)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`mover a ${nextStep.label}`}
            title={`${nextStep.label} →`}
          >
            <ChevronRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export function GenericKanban({
  items,
  workflow,
  cardFields,
}: {
  items: PillarItem[];
  workflow: PillarStatusStep[];
  cardFields: string[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
      {workflow.map((col) => {
        const colItems = items.filter((i) => i.status === col.key);
        return (
          <div key={col.key} className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center justify-between gap-2 px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{col.label}</h3>
              <span className="text-xs text-muted-foreground font-mono">{colItems.length}</span>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {colItems.map((item) => (
                <ItemCard key={item.id} item={item} workflow={workflow} cardFields={cardFields} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
