'use client';

import { useState, useTransition } from 'react';
import { Trash2, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { updateProject, deleteProject } from '@/app/projects/actions';
import { cn } from '@/lib/cn';
import type { OwnProject, ProjectStatus } from '@/lib/types';

const STATUS_BADGE: Record<ProjectStatus, { variant: 'accent' | 'warning' | 'danger' | 'muted'; label: string }> = {
  active: { variant: 'accent', label: 'activo' },
  paused: { variant: 'muted', label: 'pausado' },
  blocked: { variant: 'danger', label: 'bloqueado' },
  archived: { variant: 'muted', label: 'archivado' },
};

const NEXT_STATUS: Record<ProjectStatus, ProjectStatus> = {
  active: 'paused',
  paused: 'active',
  blocked: 'active',
  archived: 'active',
};

export function ProjectCard({ project, lastPush }: { project: OwnProject; lastPush?: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(project.status);
  const [editingNextStep, setEditingNextStep] = useState(false);
  const [nextStepValue, setNextStepValue] = useState(project.next_step ?? '');
  const badge = STATUS_BADGE[status];

  function cycleStatus() {
    const next = NEXT_STATUS[status];
    startTransition(async () => {
      setStatus(next);
      await updateProject(project.id, { status: next });
    });
  }

  function saveNextStep() {
    startTransition(async () => {
      await updateProject(project.id, { next_step: nextStepValue.trim() || null });
      setEditingNextStep(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteProject(project.id);
    });
  }

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-surface-elev p-4 flex flex-col gap-3',
        status === 'archived' && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={cycleStatus}
            disabled={isPending}
            className="mb-1"
            title={`Cambiar a ${NEXT_STATUS[status]}`}
          >
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </button>
          <h3 className="text-sm font-semibold leading-tight">
            {project.icon && <span className="mr-1.5">{project.icon}</span>}
            {project.name}
          </h3>
          {project.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{project.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="shrink-0 text-muted-foreground hover:text-danger transition-colors p-1"
          aria-label="Eliminar"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {project.last_update && (
        <p className="text-xs text-muted-foreground border-l-2 border-border pl-2">
          {project.last_update}
        </p>
      )}

      {lastPush && (
        <p className="text-[11px] text-muted-foreground font-mono">↑ {lastPush}</p>
      )}

      <div>
        {editingNextStep ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              type="text"
              value={nextStepValue}
              onChange={(e) => setNextStepValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveNextStep();
                if (e.key === 'Escape') setEditingNextStep(false);
              }}
              placeholder="Próximo paso"
              className="flex-1 rounded-sm border border-border bg-surface px-2 py-1 text-xs focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={saveNextStep}
              disabled={isPending}
              className="text-success hover:text-success/80"
            >
              <Check size={12} />
            </button>
            <button
              type="button"
              onClick={() => setEditingNextStep(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingNextStep(true)}
            className="text-xs text-left w-full"
          >
            {project.next_step ? (
              <span className="text-foreground">
                <span className="text-accent font-medium">→</span> {project.next_step}
              </span>
            ) : (
              <span className="text-muted-foreground hover:text-foreground transition-colors">
                + agregar próximo paso
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
