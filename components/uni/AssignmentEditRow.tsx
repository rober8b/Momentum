'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Circle, Pencil, Trash2, Save, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/lib/hooks/useToast';
import { formatDate, urgencyOf } from '@/lib/date';
import { toggleAssignmentDone, updateAssignment, deleteAssignment } from '@/app/uni/actions';
import { cn } from '@/lib/cn';
import type { Assignment, AssignmentStatus } from '@/lib/types';

const URGENCY_BADGE: Record<
  ReturnType<typeof urgencyOf>,
  { variant: 'danger' | 'warning' | 'accent' | 'muted' | 'default'; label: string }
> = {
  overdue: { variant: 'danger', label: 'vencido' },
  today: { variant: 'warning', label: 'hoy' },
  soon: { variant: 'accent', label: 'esta semana' },
  later: { variant: 'muted', label: 'después' },
  none: { variant: 'default', label: 'sin fecha' },
};

type Props = {
  assignment: Assignment & { subjectName: string | null };
  tz?: string;
};

export function AssignmentEditRow({ assignment, tz = 'UTC' }: Props) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(assignment.status === 'done');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const urgency = urgencyOf(assignment.due_date, tz);
  const badge = URGENCY_BADGE[urgency];

  const [title, setTitle] = useState(assignment.title);
  const [description, setDescription] = useState(assignment.description ?? '');
  const [dueDate, setDueDate] = useState(assignment.due_date ?? '');

  function toggle() {
    const next = !done;
    setDone(next);
    startTransition(async () => {
      await toggleAssignmentDone(assignment.id, next);
    });
  }

  function save() {
    startTransition(async () => {
      await updateAssignment(assignment.id, {
        title,
        description: description || null,
        due_date: dueDate || null,
      });
      toast.success('TP actualizado');
      setEditing(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteAssignment(assignment.id);
      toast.success('TP eliminado');
    });
  }

  if (editing) {
    return (
      <div className="rounded-md border border-accent/30 bg-surface-elev p-3 space-y-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">titulo</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">fecha de entrega</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">descripcion</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:border-accent resize-y"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            <X size={12} className="mr-1" /> cancelar
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={isPending || !title.trim()}>
            <Save size={12} className="mr-1" /> guardar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-md border border-border bg-surface-elev p-3 transition-opacity',
        done && 'opacity-50',
      )}
    >
      <button
        type="button"
        disabled={isPending}
        onClick={toggle}
        className="shrink-0 mt-0.5 text-muted-foreground hover:text-accent transition-colors"
        aria-label="Toggle done"
      >
        {done ? <CheckCircle2 size={16} className="text-success" /> : <Circle size={16} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium leading-tight', done && 'line-through')}>
          {assignment.title}
        </p>
        {assignment.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{assignment.description}</p>
        )}
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <Badge variant={badge.variant}>
            {badge.label}
            {assignment.due_date && urgency !== 'today' && (
              <span className="ml-1 opacity-75">{formatDate(assignment.due_date, tz)}</span>
            )}
          </Badge>
        </div>
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded p-1 text-muted-foreground hover:text-accent"
          aria-label="Editar"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="rounded p-1 text-muted-foreground hover:text-danger"
          aria-label="Eliminar"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="eliminar TP?"
      />
    </div>
  );
}
