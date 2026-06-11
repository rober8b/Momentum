'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createProject } from '@/app/projects/actions';
import { cn } from '@/lib/cn';
import { limitReachedMessage } from '@/lib/strings';
import { useToast } from '@/lib/hooks/useToast';

export function ProjectForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createProject({
        name: name.trim(),
        status: 'active',
        description: description.trim() || null,
        next_step: nextStep.trim() || null,
        links: {},
      });
      if (result && 'error' in result) {
        toast.error(limitReachedMessage(result));
        return;
      }
      setName('');
      setDescription('');
      setNextStep('');
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
        nuevo proyecto
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-border bg-surface-elev p-3 space-y-2 w-full max-w-sm">
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre del proyecto"
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
      <input
        type="text"
        value={nextStep}
        onChange={(e) => setNextStep(e.target.value)}
        placeholder="Próximo paso concreto"
        className={cn(
          'w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-sm',
          'focus:outline-none focus:border-accent placeholder:text-muted-foreground',
        )}
      />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          cancelar
        </Button>
        <Button type="submit" size="sm" disabled={isPending || !name.trim()}>
          agregar
        </Button>
      </div>
    </form>
  );
}
