'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createCommunityItem, createOrganization } from '@/app/community/actions';
import { cn } from '@/lib/cn';
import type { Organization } from '@/lib/types';

export function CommunityForm({ orgs }: { orgs: Organization[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [orgId, setOrgId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [isPending, startTransition] = useTransition();

  // New org inline state
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      await createCommunityItem({
        title: title.trim(),
        organization_id: orgId || null,
        due_date: dueDate || null,
        description: description.trim() || null,
      });
      setTitle('');
      setDueDate('');
      setDescription('');
      setOrgId('');
      setOpen(false);
    });
  }

  function submitNewOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    startTransition(async () => {
      const slug = newOrgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const row = await createOrganization({ name: newOrgName.trim(), slug });
      if (row?.id) setOrgId(row.id);
      setNewOrgName('');
      setNewOrgOpen(false);
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
        nuevo compromiso
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-border bg-surface-elev p-3 space-y-2 w-full max-w-sm">
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
      <div className="flex items-center gap-2">
        {newOrgOpen ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              autoFocus
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="nombre organización"
              className="rounded-sm border border-border bg-surface px-2 py-1 text-xs flex-1 focus:outline-none focus:border-accent"
            />
            <Button type="button" size="sm" onClick={submitNewOrg} disabled={isPending || !newOrgName.trim()}>
              +
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setNewOrgOpen(false)}>
              ✕
            </Button>
          </div>
        ) : (
          <>
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="rounded-sm border border-border bg-surface px-2 py-1 text-xs flex-1"
            >
              <option value="">sin organización</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setNewOrgOpen(true)}
              className="shrink-0 text-xs text-muted-foreground hover:text-accent transition-colors"
              title="nueva organización"
            >
              <Plus size={12} />
            </button>
          </>
        )}
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
          cancelar
        </Button>
        <Button type="submit" size="sm" disabled={isPending || !title.trim()}>
          agregar
        </Button>
      </div>
    </form>
  );
}
