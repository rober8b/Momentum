'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { createBuildItem, updateBuildItem } from '@/app/build/actions';
import { cn } from '@/lib/cn';
import type { BuildItem, BuildType } from '@/lib/types';

const TYPES: BuildType[] = ['hackathon', 'project', 'opinion', 'news', 'portfolio-update', 'open-source', 'demo'];

export function BuildEditor({
  mode,
  sourceId,
  existing,
}: {
  mode: 'create' | 'edit';
  sourceId: string | null;
  existing: BuildItem | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [hook, setHook] = useState(existing?.hook ?? '');
  const [draft, setDraft] = useState(existing?.draft ?? '');
  const [type, setType] = useState<BuildType>((existing?.type as BuildType) ?? 'project');
  const [platforms, setPlatforms] = useState<string[]>(existing?.platforms ?? ['x', 'linkedin']);
  const [relatedProject, setRelatedProject] = useState(existing?.related_project ?? '');
  const [isPending, startTransition] = useTransition();

  function togglePlatform(p: string) {
    setPlatforms(platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p]);
  }

  function save(asStatus: 'idea' | 'draft') {
    if (!title.trim()) return;
    startTransition(async () => {
      const payload = {
        title: title.trim(),
        hook: hook.trim() || null,
        draft: draft.trim() || null,
        type,
        platforms,
        related_project: relatedProject.trim() || null,
        status: asStatus,
        links: existing?.links ?? {},
        metrics: existing?.metrics ?? {},
      };
      if (mode === 'edit' && sourceId) {
        await updateBuildItem(sourceId, payload);
      } else {
        await createBuildItem(payload);
      }
      router.push('/build');
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">título</label>
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Cómo armé este stack — Next.js + Tailwind v4"
          className={cn(
            'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm',
            'focus:outline-none focus:border-accent',
          )}
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
          hook · primera línea (la que define share-via-DM en X)
        </label>
        <textarea
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          placeholder="Cada vez que arranco un proyecto nuevo me pregunto si vale la pena cambiar el stack. La respuesta casi siempre es no."
          rows={2}
          className={cn(
            'w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm font-mono',
            'focus:outline-none focus:border-accent',
          )}
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">cuerpo (markdown)</label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="..."
          rows={12}
          className={cn(
            'w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm font-mono leading-relaxed',
            'focus:outline-none focus:border-accent',
          )}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as BuildType)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
          >
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
            proyecto relacionado (opcional)
          </label>
          <input
            type="text"
            value={relatedProject}
            onChange={(e) => setRelatedProject(e.target.value)}
            placeholder="marketplace / portfolio / aleph / ..."
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">plataformas</label>
        <div className="flex gap-2">
          {['x', 'linkedin'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePlatform(p)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs transition-colors',
                platforms.includes(p)
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-surface text-muted-foreground hover:border-muted-foreground',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
        <Button type="button" variant="ghost" onClick={() => router.push('/build')}>
          cancel
        </Button>
        <Button type="button" variant="secondary" onClick={() => save('idea')} disabled={isPending || !title.trim()}>
          guardar como idea
        </Button>
        <Button type="button" onClick={() => save('draft')} disabled={isPending || !title.trim()}>
          guardar como draft
        </Button>
      </div>
    </div>
  );
}
