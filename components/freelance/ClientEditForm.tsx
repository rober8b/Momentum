'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/lib/hooks/useToast';
import { updateClient, deleteClient } from '@/app/freelance/actions';
import type { FreelanceClient, FreelanceClientStatus } from '@/lib/types';

const STATUSES: FreelanceClientStatus[] = ['active', 'paused', 'blocked', 'archived'];

export function ClientEditForm({ client }: { client: FreelanceClient }) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(client.name);
  const [description, setDescription] = useState(client.description ?? '');
  const [stack, setStack] = useState(client.stack ?? '');
  const [status, setStatus] = useState<FreelanceClientStatus>(client.status);
  const [nextStep, setNextStep] = useState(client.next_step ?? '');
  const [lastUpdate, setLastUpdate] = useState(client.last_update ?? '');
  const [linkKey, setLinkKey] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [links, setLinks] = useState<Record<string, string>>(client.links);

  function addLink() {
    if (!linkKey.trim() || !linkUrl.trim()) return;
    setLinks((prev) => ({ ...prev, [linkKey.trim()]: linkUrl.trim() }));
    setLinkKey('');
    setLinkUrl('');
  }

  function removeLink(key: string) {
    setLinks((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }

  function save() {
    startTransition(async () => {
      await updateClient(client.id, {
        name,
        description: description || null,
        stack: stack || null,
        status,
        next_step: nextStep || null,
        last_update: lastUpdate || null,
        links,
      });
      toast.success('cliente actualizado');
      setEditing(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteClient(client.id);
      toast.success('cliente eliminado');
      router.push('/freelance');
    });
  }

  if (!editing) {
    return (
      <div className="flex gap-1">
        <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
          <Pencil size={12} className="mr-1" /> editar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} aria-label="Eliminar">
          <Trash2 size={14} />
        </Button>
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
          title="eliminar cliente?"
          description="se eliminan tambien todas las tareas del cliente."
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">editar cliente</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          <X size={14} />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as FreelanceClientStatus)}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">stack</label>
        <input
          value={stack}
          onChange={(e) => setStack(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">descripcion</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">proximo paso</label>
          <input
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">ultimo avance</label>
          <input
            value={lastUpdate}
            onChange={(e) => setLastUpdate(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">links</label>
        <div className="mt-1 space-y-1.5">
          {Object.entries(links).map(([key, url]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="text-accent">{key}</span>
              <span className="truncate text-muted-foreground flex-1">{url}</span>
              <button type="button" onClick={() => removeLink(key)} className="text-danger hover:text-danger/80">
                <X size={12} />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              placeholder="label"
              value={linkKey}
              onChange={(e) => setLinkKey(e.target.value)}
              className="w-24 rounded-sm border border-border bg-surface px-2 py-1 text-xs focus:outline-none focus:border-accent"
            />
            <input
              placeholder="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="flex-1 rounded-sm border border-border bg-surface px-2 py-1 text-xs focus:outline-none focus:border-accent"
            />
            <Button type="button" size="sm" variant="ghost" onClick={addLink}>+</Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          cancelar
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={isPending || !name.trim()}>
          <Save size={12} className="mr-1" /> guardar
        </Button>
      </div>
    </div>
  );
}
