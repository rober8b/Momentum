'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/lib/hooks/useToast';
import { updateWorkblock, deleteWorkblock } from '@/app/work/actions';
import { formatDate } from '@/lib/date';
import type { Workblock, WorkblockType, WorkblockStatus, WorkblockPriority } from '@/lib/types';

const TYPES: WorkblockType[] = ['ticket', 'task', 'meeting', 'review'];
const STATUSES: WorkblockStatus[] = ['backlog', 'today', 'in-progress', 'blocked', 'done'];
const PRIORITIES: WorkblockPriority[] = ['low', 'med', 'high'];

export function WorkblockEditForm({ workblock }: { workblock: Workblock }) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [title, setTitle] = useState(workblock.title);
  const [description, setDescription] = useState(workblock.description ?? '');
  const [notes, setNotes] = useState(workblock.notes ?? '');
  const [type, setType] = useState<WorkblockType>(workblock.type);
  const [status, setStatus] = useState<WorkblockStatus>(workblock.status);
  const [priority, setPriority] = useState<WorkblockPriority>(workblock.priority);
  const [dueDate, setDueDate] = useState(workblock.due_date ?? '');
  const [linkKey, setLinkKey] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [links, setLinks] = useState<Record<string, string>>(workblock.links);

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
      await updateWorkblock(workblock.id, {
        title,
        description: description || null,
        notes: notes || null,
        type,
        status,
        priority,
        due_date: dueDate || null,
        links,
      });
      toast.success('workblock actualizado');
      setEditing(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteWorkblock(workblock.id);
      toast.success('workblock eliminado');
      router.push('/work');
    });
  }

  if (!editing) {
    return (
      <>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge variant="default">{workblock.type}</Badge>
              <Badge variant={workblock.priority === 'high' ? 'danger' : workblock.priority === 'med' ? 'warning' : 'muted'}>
                {workblock.priority}
              </Badge>
              <Badge variant="accent">{workblock.status}</Badge>
              {workblock.due_date && <Badge variant="warning">due {formatDate(workblock.due_date)}</Badge>}
            </div>
            <h1 className="text-2xl font-semibold leading-tight">{workblock.title}</h1>
          </div>
          <div className="flex gap-1">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
              editar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} aria-label="Delete">
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        {workblock.description && (
          <Card className="mb-4">
            <CardHeader><CardTitle>descripcion</CardTitle></CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap">{workblock.description}</CardContent>
          </Card>
        )}

        {workblock.notes && (
          <Card className="mb-4">
            <CardHeader><CardTitle>notas</CardTitle></CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap font-mono">{workblock.notes}</CardContent>
          </Card>
        )}

        {Object.keys(workblock.links).length > 0 && (
          <Card className="mb-4">
            <CardHeader><CardTitle>links</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {Object.entries(workblock.links).map(([key, url]) => (
                  <li key={key}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
                      {key} → {url}
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>meta</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1 font-mono">
            <div>created: {new Date(workblock.created_at).toLocaleString('es-AR')}</div>
            {workblock.completed_at && (
              <div>completed: {new Date(workblock.completed_at).toLocaleString('es-AR')}</div>
            )}
            <div>client: {workblock.client}</div>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
          title="eliminar workblock?"
          description="esta accion no se puede deshacer."
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-lg font-semibold">editando workblock</h2>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          <X size={14} />
        </Button>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">titulo</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as WorkblockType)}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
          >
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as WorkblockStatus)}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">prioridad</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as WorkblockPriority)}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
          >
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">descripcion</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">notas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent resize-y"
        />
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
        <Button type="button" size="sm" onClick={save} disabled={isPending || !title.trim()}>
          <Save size={12} className="mr-1" />
          guardar
        </Button>
      </div>
    </div>
  );
}
