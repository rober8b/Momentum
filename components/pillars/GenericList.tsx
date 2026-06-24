'use client';

import { useState, useTransition } from 'react';
import { Trash2, List } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { updatePillarItemStatus, deletePillarItem } from '@/app/p/actions';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/hooks/useToast';
import { statusWorkflowFor } from '@/lib/pillars';
import { badgeVariant, readCardField } from './pillar-render-utils';
import type { Pillar, PillarItem, PillarStatusStep } from '@/lib/types';

function nextStatus(workflow: PillarStatusStep[], current: string): string {
  const idx = workflow.findIndex((s) => s.key === current);
  if (idx === -1) return workflow[0]?.key ?? current;
  return workflow[(idx + 1) % workflow.length].key;
}

function sortByField(items: PillarItem[], sortField: string | undefined): PillarItem[] {
  if (sortField !== 'due_date') return items;
  return [...items].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
}

// A non-container item — e.g. a Community commitment, grouped or ungrouped.
// Status workflow is picked by the item's own is_container flag (always
// false here), not by whether it has a parent — see lib/pillars.ts.
function ListRow({ item, pillar }: { item: PillarItem; pillar: Pillar }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(item.status);
  const toast = useToast();
  const workflow = statusWorkflowFor(pillar, item.is_container);
  const step = workflow.find((s) => s.key === status);
  const cardFields = pillar.config.childView?.cardFields ?? [];

  function cycleStatus() {
    const next = nextStatus(workflow, status);
    const prev = status;
    startTransition(async () => {
      setStatus(next);
      const result = await updatePillarItemStatus(item.id, next);
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
    <div className={cn('group flex items-start gap-3 rounded-md border border-border bg-surface-elev p-3', step?.is_terminal && 'opacity-50')}>
      <button type="button" onClick={cycleStatus} disabled={isPending} className="shrink-0 mt-0.5" title={`cambiar estado (siguiente: ${nextStatus(workflow, status)})`}>
        <Badge variant={badgeVariant(step?.color)}>{step?.label ?? status}</Badge>
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium leading-tight', step?.is_terminal && 'line-through')}>{item.title}</p>
        {cardFields
          .map((f) => readCardField(item, f))
          .filter((text): text is string => Boolean(text))
          .map((text, i) => (
            <p key={i} className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {text}
            </p>
          ))}
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="shrink-0 text-muted-foreground hover:text-danger transition-colors p-1 opacity-0 group-hover:opacity-100"
        aria-label="eliminar"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function GroupSection({
  pillar,
  container,
  title,
  items,
}: {
  pillar: Pillar;
  container: PillarItem | null;
  title: string;
  items: PillarItem[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleDeleteContainer() {
    if (!container) return;
    startTransition(async () => {
      await deletePillarItem(container.id);
    });
  }

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {container && (
          <button
            type="button"
            onClick={handleDeleteContainer}
            disabled={isPending}
            className="text-muted-foreground hover:text-danger transition-colors p-1"
            aria-label={`eliminar ${title}`}
            title={`eliminar ${title}`}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">sin items todavía.</p>
        ) : (
          items.map((item) => <ListRow key={item.id} item={item} pillar={pillar} />)
        )}
      </div>
    </div>
  );
}

// Generic 'list' view renderer. Supports an OPTIONAL-grouping mode
// (config.groupByField: 'parent_item_id') for pillars like Community where
// a child item may or may not have a container — see
// docs/DYNAMIC_PILLARS.md. Unlike GenericGrid/GenericKanban, this expects
// the FULL item set for the pillar (containers + children + ungrouped
// top-level items), not just top-level items, since grouping happens here
// rather than via a separate drill-down page.
export function GenericList({ pillar, items }: { pillar: Pillar; items: PillarItem[] }) {
  if (items.length === 0) {
    return <EmptyState icon={List} title="sin items todavía" description="agregá el primero con el formulario de arriba." />;
  }

  if (pillar.config.groupByField === 'parent_item_id') {
    const containers = items.filter((i) => i.is_container);
    const rest = items.filter((i) => !i.is_container);
    const byParent = new Map<string, PillarItem[]>();
    const ungrouped: PillarItem[] = [];
    for (const item of rest) {
      if (item.parent_item_id) {
        const arr = byParent.get(item.parent_item_id) ?? [];
        arr.push(item);
        byParent.set(item.parent_item_id, arr);
      } else {
        ungrouped.push(item);
      }
    }

    return (
      <div className="space-y-4">
        {containers.map((c) => (
          <GroupSection key={c.id} pillar={pillar} container={c} title={c.title} items={sortByField(byParent.get(c.id) ?? [], pillar.config.sortField as string | undefined)} />
        ))}
        {ungrouped.length > 0 && (
          <GroupSection pillar={pillar} container={null} title="sin organización" items={sortByField(ungrouped, pillar.config.sortField as string | undefined)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortByField(items, pillar.config.sortField as string | undefined).map((item) => (
        <ListRow key={item.id} item={item} pillar={pillar} />
      ))}
    </div>
  );
}
