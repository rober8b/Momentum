'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createFreelanceTask } from '@/app/freelance/actions';
import { cn } from '@/lib/cn';
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      await createFreelanceTask({
        client_id: clientId,
        title: title.trim(),
        priority,
        status: defaultStatus,
      });
      setTitle('');
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-accent hover:text-accent transition-colors inline-flex items-center justify-center gap-1.5"
      >
        <Plus size={12} />
        agregar
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-border bg-surface-elev p-3 space-y-2">
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
      <div className="flex items-center gap-2">
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
  );
}
