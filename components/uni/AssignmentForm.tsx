'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createAssignment } from '@/app/uni/actions';
import { cn } from '@/lib/cn';
import { limitReachedMessage } from '@/lib/strings';
import { useToast } from '@/lib/hooks/useToast';
import type { Subject } from '@/lib/types';

export function AssignmentForm({ subjects }: { subjects: Subject[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState<string>(subjects[0]?.id ?? '');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !subjectId) return;
    startTransition(async () => {
      const result = await createAssignment({
        title: title.trim(),
        subject_id: subjectId,
        due_date: dueDate || null,
        description: description.trim() || null,
      });
      if (result && 'error' in result) {
        toast.error(limitReachedMessage(result));
        return;
      }
      setTitle('');
      setDescription('');
      setDueDate('');
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-accent hover:text-accent transition-colors"
      >
        <Plus size={12} />
        nuevo TP
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
        placeholder="Título del TP"
        className={cn(
          'w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-sm',
          'focus:outline-none focus:border-accent',
        )}
      />
      <div className="flex items-center gap-2">
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="rounded-sm border border-border bg-surface px-2 py-1 text-xs flex-1"
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-sm border border-border bg-surface px-2 py-1 text-xs"
        />
      </div>
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
      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending || !title.trim() || !subjectId}>
          agregar
        </Button>
      </div>
    </form>
  );
}
