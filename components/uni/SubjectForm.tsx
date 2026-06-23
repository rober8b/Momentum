'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormDialog } from '@/components/ui/FormDialog';
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

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus size={12} className="mr-1" /> agregar materia
      </Button>
      <FormDialog open={open} onClose={() => setOpen(false)} title="nueva materia">
        <div className="space-y-2">
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
          <div className="flex items-center justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              cancelar
            </Button>
            <Button type="button" size="sm" onClick={submit} disabled={isPending || !name.trim()}>
              crear
            </Button>
          </div>
        </div>
      </FormDialog>
    </>
  );
}
