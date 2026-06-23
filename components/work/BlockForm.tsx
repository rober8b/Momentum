'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormDialog } from '@/components/ui/FormDialog';
import { createWorkblock } from '@/app/work/actions';
import { cn } from '@/lib/cn';
import { limitReachedMessage } from '@/lib/strings';
import { useToast } from '@/lib/hooks/useToast';
import type { WorkblockStatus, WorkblockPriority, WorkblockType } from '@/lib/types';

export function BlockForm({ defaultStatus = 'backlog' }: { defaultStatus?: WorkblockStatus }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<WorkblockPriority>('med');
  const [type, setType] = useState<WorkblockType>('task');
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await createWorkblock({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        type,
        status: defaultStatus,
        client: '',
        links: {},
      });
      if (result && 'error' in result) {
        toast.error(limitReachedMessage(result));
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
        className="w-full rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-accent hover:text-accent transition-colors inline-flex items-center justify-center gap-1.5"
      >
        <Plus size={12} />
        agregar
      </button>
      <FormDialog open={open} onClose={() => setOpen(false)} title="nuevo workblock">
        <form onSubmit={submit} className="space-y-2">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            className={cn(
              'w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-sm',
              'focus:outline-none focus:border-accent',
            )}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (opcional)"
            rows={2}
            className={cn(
              'w-full resize-none rounded-sm border border-border bg-surface px-2 py-1.5 text-sm',
              'focus:outline-none focus:border-accent placeholder:text-muted-foreground',
            )}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WorkblockType)}
              className="rounded-sm border border-border bg-surface px-2 py-1 text-xs"
            >
              <option value="task">task</option>
              <option value="ticket">ticket</option>
              <option value="meeting">meeting</option>
              <option value="review">review</option>
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as WorkblockPriority)}
              className="rounded-sm border border-border bg-surface px-2 py-1 text-xs"
            >
              <option value="low">low</option>
              <option value="med">med</option>
              <option value="high">high</option>
            </select>
            <div className="flex-1" />
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !title.trim()}>
              add
            </Button>
          </div>
        </form>
      </FormDialog>
    </>
  );
}
