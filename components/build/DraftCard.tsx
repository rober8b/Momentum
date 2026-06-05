'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Edit3, Trash2, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/lib/hooks/useToast';
import { markPublished, deleteBuildItem, updateBuildStatus } from '@/app/build/actions';
import type { BuildItem } from '@/lib/types';

export function DraftCard({ item }: { item: BuildItem }) {
  const toast = useToast();
  const [showPublish, setShowPublish] = useState(false);
  const [xUrl, setXUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      await deleteBuildItem(item.id);
      toast.success('item eliminado');
    });
  }

  function handleDiscard() {
    startTransition(async () => {
      await updateBuildStatus(item.id, 'discarded');
      toast.info('item descartado');
    });
  }

  function publish() {
    const links: Record<string, string> = {};
    if (xUrl) links.x = xUrl;
    if (linkedinUrl) links.linkedin = linkedinUrl;
    startTransition(async () => {
      await markPublished(item.id, links);
      setShowPublish(false);
    });
  }

  return (
    <div className="rounded-md border border-border bg-surface-elev p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight flex-1 min-w-0">{item.title}</p>
        <Badge variant="warning">draft</Badge>
      </div>
      {item.hook && (
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 font-mono">
          {item.hook}
        </p>
      )}
      {item.draft && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
          {item.draft.slice(0, 200)}{item.draft.length > 200 && '…'}
        </p>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.platforms.map((p) => (
            <Badge key={p} variant="default">{p}</Badge>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/build/new?edit=${item.id}`}
            className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Edit"
            title="Edit"
          >
            <Edit3 size={12} />
          </Link>
          <button
            type="button"
            onClick={() => setShowPublish(!showPublish)}
            className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-success"
            aria-label="Mark published"
            title="publicar"
          >
            <CheckCircle2 size={12} />
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-warning"
            aria-label="Descartar"
            title="descartar"
          >
            <Ban size={12} />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-danger"
            aria-label="Eliminar"
            title="eliminar"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {showPublish && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            links de publicación (opcional)
          </p>
          <input
            type="url"
            placeholder="URL en X"
            value={xUrl}
            onChange={(e) => setXUrl(e.target.value)}
            className="w-full rounded-sm border border-border bg-surface px-2 py-1 text-xs focus:outline-none focus:border-accent"
          />
          <input
            type="url"
            placeholder="URL en LinkedIn"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            className="w-full rounded-sm border border-border bg-surface px-2 py-1 text-xs focus:outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowPublish(false)}>
              cancel
            </Button>
            <Button type="button" size="sm" onClick={publish} disabled={isPending}>
              mark published
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="eliminar draft?"
      />
    </div>
  );
}

export function PublishedRow({ item }: { item: BuildItem }) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      await deleteBuildItem(item.id);
      toast.success('item eliminado');
    });
  }

  return (
    <div className="group rounded-md border border-border bg-surface-elev p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight flex-1 min-w-0">{item.title}</p>
        <div className="flex items-center gap-1">
          <Badge variant="success">published</Badge>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-danger transition-opacity"
            aria-label="Eliminar"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        <span className="font-mono">
          {item.published_at && new Date(item.published_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
        </span>
        {Object.entries(item.links).map(([key, url]) => (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-accent transition-colors"
          >
            <ExternalLink size={10} />
            {key}
          </a>
        ))}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="eliminar publicacion?"
      />
    </div>
  );
}
