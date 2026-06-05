'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/app/freelance/actions';
import { cn } from '@/lib/cn';

export function ClientForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stack, setStack] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      await createClient({
        name: name.trim(),
        status: 'active',
        description: description.trim() || null,
        stack: stack.trim() || null,
        links: {},
      });
      setName('');
      setDescription('');
      setStack('');
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
        nuevo cliente
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
        placeholder="Nombre del cliente"
        className={cn(
          'w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-sm',
          'focus:outline-none focus:border-accent',
        )}
      />
      <input
        type="text"
        value={stack}
        onChange={(e) => setStack(e.target.value)}
        placeholder="Stack (ej: Next.js, Prisma)"
        className={cn(
          'w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-sm',
          'focus:outline-none focus:border-accent placeholder:text-muted-foreground',
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
