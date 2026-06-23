'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormDialog } from '@/components/ui/FormDialog';
import { createFreelanceTask } from '@/app/freelance/actions';
import { cn } from '@/lib/cn';
import { limitReachedMessage } from '@/lib/strings';
import { useToast } from '@/lib/hooks/useToast';
import type { FreelanceTaskStatus, WorkblockPriority } from '@/lib/types';

export function TaskForm({
  clientId,
  defaultStatus = 'backlog',
}: {
  clientId: string;
  defaultStatus?: FreelanceTaskStatus;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<WorkblockPriority>('med');
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await createFreelanceTask({
        client_id: clientId,
        title: title.trim(),
        priority,
        status: defaultStatus,
      });
      if (result && 'error' in result) {
        toast.error(limitReachedMessage(result));
        return;
      }
      setTitle('');
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
      <FormDialog open={open} onClose={() => setOpen(false)} title="nueva tarea">
        <form onSubmit={submit} className="space-y-2">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título de la tarea"
            className={cn(
              'w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-sm',
              'focus:outline-none focus:border-accent',
            )}
          />
          <div className="flex items-center gap-2 flex-wrap">
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
