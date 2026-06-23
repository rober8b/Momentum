'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormDialog } from '@/components/ui/FormDialog';
import { createPillarItem } from '@/app/p/actions';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/hooks/useToast';
import type { Pillar, PillarItem, PillarStatusStep } from '@/lib/types';

export function PillarItemForm({
  pillar,
  parentItem,
  statusWorkflow,
  isContainer = false,
  label = 'nuevo item',
}: {
  pillar: Pillar;
  // When set, the created item becomes a child of this container (e.g. a
  // task under a Freelance client). See docs/DYNAMIC_PILLARS.md.
  parentItem?: PillarItem;
  // Status options for the new item. Defaults to the pillar's own
  // status_workflow; hierarchical pillars pass their child workflow
  // (pillar.config.childView.status_workflow) when creating a child.
  statusWorkflow?: PillarStatusStep[];
  // Whether the created item is itself a container (e.g. a new client).
  isContainer?: boolean;
  label?: string;
}) {
  const workflow = statusWorkflow ?? pillar.status_workflow;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState(workflow[0]?.key ?? '');
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await createPillarItem({
        pillarId: pillar.id,
        title: title.trim(),
        description: description.trim() || null,
        status,
        parent_item_id: parentItem?.id ?? null,
        is_container: isContainer,
        fields: {},
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTitle('');
      setDescription('');
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-accent hover:text-accent transition-colors"
      >
        <Plus size={12} />
        {label}
      </button>
      <FormDialog open={open} onClose={() => setOpen(false)} title={label}>
        <form onSubmit={submit} className="space-y-2">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="título"
            className={cn(
              'w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-sm',
              'focus:outline-none focus:border-accent',
            )}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="descripción (opcional)"
            rows={2}
            className={cn(
              'w-full resize-none rounded-sm border border-border bg-surface px-2 py-1.5 text-sm',
              'focus:outline-none focus:border-accent placeholder:text-muted-foreground',
            )}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
          >
            {workflow.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !title.trim()}>
              agregar
            </Button>
          </div>
        </form>
      </FormDialog>
    </>
  );
}
