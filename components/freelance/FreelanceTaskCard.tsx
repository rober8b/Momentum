'use client';

import { useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/lib/hooks/useToast';
import { updateFreelanceTaskStatus, deleteFreelanceTask } from '@/app/freelance/actions';
import { cn } from '@/lib/cn';
import type { FreelanceTask, FreelanceTaskStatus } from '@/lib/types';

const FLOW: FreelanceTaskStatus[] = ['backlog', 'today', 'in-progress', 'blocked', 'done'];

export function FreelanceTaskCard({ task }: { task: FreelanceTask }) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(task.status);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentIdx = FLOW.indexOf(status);
  const prev = currentIdx > 0 ? FLOW[currentIdx - 1] : null;
  const next = currentIdx < FLOW.length - 1 ? FLOW[currentIdx + 1] : null;

  function move(target: FreelanceTaskStatus) {
    setStatus(target);
    startTransition(async () => {
      await updateFreelanceTaskStatus(task.id, target);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteFreelanceTask(task.id);
      toast.success('tarea eliminada');
    });
  }

  return (
    <div className={cn(
      'group rounded-md border border-border bg-surface-elev p-2.5 transition-opacity',
      isPending && 'opacity-50',
    )}>
      <p className="text-sm font-medium leading-tight">{task.title}</p>
      <div className="mt-2 flex items-center justify-between gap-1">
        <Badge
          variant={task.priority === 'high' ? 'danger' : task.priority === 'med' ? 'warning' : 'muted'}
        >
          {task.priority}
        </Badge>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {prev && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => move(prev)}
              className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              title={`← ${prev}`}
            >
              <ChevronLeft size={12} />
            </button>
          )}
          {next && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => move(next)}
              className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              title={`${next} →`}
            >
              <ChevronRight size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded px-1 py-0.5 text-muted-foreground hover:text-danger"
            aria-label="Eliminar tarea"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="eliminar tarea?"
      />
    </div>
  );
}
