'use client';

import { useState, useTransition } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { quickCaptureIdea } from '@/app/build/actions';
import { cn } from '@/lib/cn';
import type { BuildItem } from '@/lib/types';

const STATUS_BADGE = {
  idea: { variant: 'muted' as const, label: 'idea' },
  draft: { variant: 'warning' as const, label: 'draft' },
  scheduled: { variant: 'accent' as const, label: 'scheduled' },
  published: { variant: 'success' as const, label: 'published' },
  discarded: { variant: 'default' as const, label: 'discarded' },
};

export function BuildPrompt({ items }: { items: BuildItem[] }) {
  const [draft, setDraft] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!draft.trim()) return;
    startTransition(async () => {
      await quickCaptureIdea(draft.trim());
      setDraft('');
    });
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Quick capture */}
      <div className="rounded-md border border-border bg-surface-elev p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Sparkles size={12} />
          <span>capturá una idea ahora</span>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="Demo de Catalog Crew para X..."
            className={cn(
              'min-w-0 flex-1 resize-none rounded-sm border border-border bg-surface px-2 py-1.5 text-sm',
              'focus:outline-none focus:border-accent placeholder:text-muted-foreground',
            )}
          />
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={isPending || !draft.trim()}
            aria-label="Capture"
          >
            <Send size={12} />
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          ⌘/Ctrl + Enter para guardar
        </p>
      </div>

      {/* Lista de pendientes */}
      <div className="flex-1 overflow-auto space-y-2 pr-1">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            sin ideas ni drafts pendientes.<br />
            empezá capturando una idea arriba.
          </p>
        )}
        {items.map((item) => {
          const badge = STATUS_BADGE[item.status];
          return (
            <div
              key={item.id}
              className="rounded-md border border-border bg-surface-elev p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm leading-tight flex-1 min-w-0">{item.title}</p>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
              {item.hook && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1 font-mono">
                  {item.hook}
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {item.type.replace('-', ' ')}
                </span>
                {item.platforms.map((p) => (
                  <span key={p} className="text-[10px] text-muted-foreground">·  {p}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground italic text-center px-2">
        santtiagom_: "publicar como hábito, una vez al día. no tiene que ser elaborado."
      </p>
    </div>
  );
}
