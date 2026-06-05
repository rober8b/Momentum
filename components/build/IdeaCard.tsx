'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { updateBuildStatus, deleteBuildItem } from '@/app/build/actions';
import type { BuildItem } from '@/lib/types';

export function IdeaCard({ item }: { item: BuildItem }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="group rounded-md border border-border bg-surface-elev p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-tight flex-1 min-w-0">{item.title}</p>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(async () => { await deleteBuildItem(item.id); })}
          className="text-muted-foreground hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Delete"
        >
          <X size={12} />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Badge variant="muted">{item.type}</Badge>
        <div className="flex items-center gap-1">
          <Link
            href={`/build/new?from=${item.id}`}
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            draft <ArrowRight size={10} />
          </Link>
        </div>
      </div>
    </div>
  );
}
