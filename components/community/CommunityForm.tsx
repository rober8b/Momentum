'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createCommunityItem } from '@/app/community/actions';
import { cn } from '@/lib/cn';
import type { CommunityOrg } from '@/lib/types';

const ORG_OPTIONS: { value: CommunityOrg; label: string }[] = [
  { value: 'ai-consensus', label: 'AI Consensus' },
  { value: 'levellers', label: 'The Levellers' },
  { value: 'xplora', label: 'Xplora UCEMA' },
  { value: 'other', label: 'Otros' },
];

export function CommunityForm() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [org, setOrg] = useState<CommunityOrg>('ai-consensus');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      await createCommunityItem({
        title: title.trim(),
        organization: org,
        due_date: dueDate || null,
        description: description.trim() || null,
      });
      setTitle('');
      setDueDate('');
      setDescription('');
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
        <select
          value={org}
          onChange={(e) => setOrg(e.target.value as CommunityOrg)}
          className="rounded-sm border border-border bg-surface px-2 py-1 text-xs flex-1"
        >
          {ORG_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
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
          cancelar
        </Button>
        <Button type="submit" size="sm" disabled={isPending || !title.trim()}>
          agregar
        </Button>
      </div>
    </form>
  );
}
