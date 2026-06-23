'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormDialog } from '@/components/ui/FormDialog';
import { createPillarItem } from '@/app/p/actions';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/hooks/useToast';
import type { Pillar } from '@/lib/types';

export function PillarItemForm({ pillar }: { pillar: Pillar }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState(pillar.status_workflow[0]?.key ?? '');
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
        nuevo item
      </button>
      <FormDialog open={open} onClose={() => setOpen(false)} title="nuevo item">
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
            {pillar.status_workflow.map((s) => (
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
