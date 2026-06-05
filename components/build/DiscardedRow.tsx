'use client';

import { useTransition } from 'react';
import { ArchiveRestore } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/lib/hooks/useToast';
import { updateBuildStatus } from '@/app/build/actions';
import type { BuildItem } from '@/lib/types';

export function DiscardedRow({ item }: { item: BuildItem }) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  function restore() {
    startTransition(async () => {
      await updateBuildStatus(item.id, 'idea');
      toast.success('restaurado como idea');
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-elev p-2.5 opacity-60">
      <div className="min-w-0 flex-1">
        <p className="text-sm line-through">{item.title}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge variant="muted">descartado</Badge>
        <button
          type="button"
          onClick={restore}
          disabled={isPending}
          className="rounded p-1 text-muted-foreground hover:text-accent transition-colors"
          title="restaurar como idea"
        >
          <ArchiveRestore size={14} />
        </button>
      </div>
    </div>
  );
}
