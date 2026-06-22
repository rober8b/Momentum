'use client';

import { useState, useTransition } from 'react';
import { Trash2, LayoutGrid } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { updatePillarItemStatus, deletePillarItem } from '@/app/p/actions';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/hooks/useToast';
import type { Pillar, PillarItem, PillarStatusStep } from '@/lib/types';

type BadgeVariant = 'default' | 'accent' | 'warning' | 'danger' | 'success' | 'muted';
const BADGE_VARIANTS = new Set<string>(['default', 'accent', 'warning', 'danger', 'success', 'muted']);

function badgeVariant(color: string | undefined): BadgeVariant {
  return color && BADGE_VARIANTS.has(color) ? (color as BadgeVariant) : 'default';
}

// Reads a cardFields entry against the item. Plain keys read typed columns
// (description, status); 'fields.x' keys read the jsonb fields bag.
// See docs/DYNAMIC_PILLARS.md — "config shape per view type".
function readCardField(item: PillarItem, key: string): string | null {
  if (key.startsWith('fields.')) {
    const value = item.fields[key.slice('fields.'.length)];
    return typeof value === 'string' && value ? value : null;
  }
  if (key === 'description') return item.description;
  if (key === 'status') return null; // status is rendered as the badge, not as text
  return null;
}

function nextStatus(workflow: PillarStatusStep[], current: string): string {
  const idx = workflow.findIndex((s) => s.key === current);
  if (idx === -1) return workflow[0]?.key ?? current;
  return workflow[(idx + 1) % workflow.length].key;
}

function ItemCard({ item, pillar }: { item: PillarItem; pillar: Pillar }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(item.status);
  const toast = useToast();
  const step = pillar.status_workflow.find((s) => s.key === status);
  const cardFields = Array.isArray(pillar.config.cardFields) ? (pillar.config.cardFields as string[]) : [];

  function cycleStatus() {
    const next = nextStatus(pillar.status_workflow, status);
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
    <div className={cn('rounded-md border border-border bg-surface-elev p-4 flex flex-col gap-3', step?.is_terminal && 'opacity-50')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={cycleStatus} disabled={isPending} className="mb-1" title={`cambiar estado (siguiente: ${nextStatus(pillar.status_workflow, status)})`}>
            <Badge variant={badgeVariant(step?.color)}>{step?.label ?? status}</Badge>
          </button>
          <h3 className="text-sm font-semibold leading-tight">{item.title}</h3>
        </div>
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
        .filter((f) => f !== 'status')
        .map((f) => readCardField(item, f))
        .filter((text): text is string => Boolean(text))
        .map((text, i) => (
          <p key={i} className="text-xs text-muted-foreground line-clamp-2">
            {text}
          </p>
        ))}
    </div>
  );
}

export function GenericGrid({ pillar, items }: { pillar: Pillar; items: PillarItem[] }) {
  if (items.length === 0) {
    return <EmptyState icon={LayoutGrid} title="sin items todavía" description="agregá el primero con el formulario de arriba." />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} pillar={pillar} />
      ))}
    </div>
  );
}
