'use client';

import { useState, useTransition } from 'react';
import { FileText, Link2, Presentation, Video, Plus, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/hooks/useToast';
import { addResource, removeResource } from '@/app/uni/actions';
import type { AssignmentResource } from '@/lib/types';

const TYPE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  link: Link2,
  slide: Presentation,
  video: Video,
};

const TYPES = ['pdf', 'link', 'slide', 'video'] as const;

export function ResourceList({
  assignmentId,
  resources,
}: {
  assignmentId: string;
  resources: AssignmentResource[];
}) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<string>('pdf');

  function handleAdd() {
    if (!name.trim() || !url.trim()) return;
    startTransition(async () => {
      await addResource(assignmentId, { name: name.trim(), url: url.trim(), type });
      toast.success('recurso agregado');
      setName('');
      setUrl('');
      setShowAdd(false);
    });
  }

  function handleRemove(resourceUrl: string) {
    startTransition(async () => {
      await removeResource(assignmentId, resourceUrl);
      toast.success('recurso eliminado');
    });
  }

  return (
    <div className="space-y-2">
      {resources.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground py-2">
          sin recursos todavia. agrega PDFs, links, slides o videos.
        </p>
      )}

      {resources.map((r) => {
        const Icon = TYPE_ICONS[r.type ?? 'link'] ?? Link2;
        return (
          <div
            key={r.url}
            className="group flex items-center gap-2 rounded-md border border-border bg-surface-elev p-2.5"
          >
            <Icon size={14} className="shrink-0 text-accent" />
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-sm text-foreground hover:text-accent transition-colors truncate"
            >
              {r.name}
              <ExternalLink size={10} className="inline ml-1 opacity-50" />
            </a>
            {r.type && (
              <span className="text-[10px] text-muted-foreground uppercase">{r.type}</span>
            )}
            <button
              type="button"
              onClick={() => handleRemove(r.url)}
              disabled={isPending}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-danger transition-opacity"
              aria-label="Eliminar recurso"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}

      {showAdd ? (
        <div className="rounded-md border border-accent/30 bg-surface p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="nombre del recurso"
              className="rounded-sm border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
              autoFocus
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-sm border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (OneDrive, Google Drive, web...)"
            className="w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleAdd} disabled={isPending || !name.trim() || !url.trim()}>
              agregar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={12} className="mr-1" /> agregar recurso
        </Button>
      )}
    </div>
  );
}
