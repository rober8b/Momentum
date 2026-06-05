'use client';

import { useState, useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/hooks/useToast';
import { createSubject } from '@/app/uni/actions';

export function SubjectForm() {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [semester, setSemester] = useState('2026-1');
  const [vaultSlug, setVaultSlug] = useState('');

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createSubject({
        name: name.trim(),
        semester,
        schedule: [],
        vault_slug: vaultSlug.trim() || null,
      });
      toast.success('materia creada');
      setName('');
      setVaultSlug('');
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus size={12} className="mr-1" /> agregar materia
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">nueva materia</span>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="nombre de la materia"
        className="w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          placeholder="semestre (ej: 2026-1)"
          className="rounded-sm border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
        />
        <input
          value={vaultSlug}
          onChange={(e) => setVaultSlug(e.target.value)}
          placeholder="vault slug (opcional)"
          className="rounded-sm border border-border bg-surface px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-accent"
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={submit} disabled={isPending || !name.trim()}>
          crear
        </Button>
      </div>
    </div>
  );
}
