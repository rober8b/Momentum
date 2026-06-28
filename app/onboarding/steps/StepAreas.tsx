'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { OnboardingArea, OnboardingContext } from '../types';

export const AREA_DEFAULTS: Record<OnboardingContext, OnboardingArea[]> = {
  student:   ['uni', 'community', 'projects'],
  developer: ['work', 'projects', 'build'],
  freelancer:['freelance', 'work', 'projects'],
  builder:   ['projects', 'build', 'community'],
  mix:       ['work', 'uni', 'freelance', 'projects', 'community', 'build'],
};

const AREA_OPTIONS: { key: OnboardingArea; label: string; sub: string }[] = [
  { key: 'work',      label: 'trabajo laboral',      sub: 'tickets, tareas y reviews' },
  { key: 'uni',       label: 'universidad',           sub: 'materias y TPs' },
  { key: 'freelance', label: 'clientes freelance',    sub: 'clientes y sus tareas' },
  { key: 'projects',  label: 'proyectos propios',     sub: 'side projects e ideas' },
  { key: 'community', label: 'comunidad / eventos',   sub: 'compromisos y organizaciones' },
  { key: 'build',     label: 'build-in-public',       sub: 'contenido e ideas' },
];

type Props = {
  context: OnboardingContext;
  onConfirm: (areas: OnboardingArea[]) => void;
  onBack: () => void;
  onSkip: () => void;
};

export function StepAreas({ context, onConfirm, onBack, onSkip }: Props) {
  const [selected, setSelected] = useState<Set<OnboardingArea>>(
    () => new Set(AREA_DEFAULTS[context]),
  );

  function toggle(area: OnboardingArea) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(area)) {
        next.delete(area);
      } else {
        next.add(area);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">¿qué querés gestionar?</h2>
        <p className="text-sm text-muted-foreground mt-1">podés cambiar esto después desde settings</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {AREA_OPTIONS.map((option) => {
          const active = selected.has(option.key);
          return (
            <button
              key={option.key}
              onClick={() => toggle(option.key)}
              className={[
                'text-left rounded-xl border px-3 py-2.5 transition-colors',
                active
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-surface-elev text-foreground hover:border-accent/50',
              ].join(' ')}
            >
              <p className="text-sm font-medium leading-snug">{option.label}</p>
              <p className={['text-xs mt-0.5', active ? 'text-accent/70' : 'text-muted-foreground'].join(' ')}>
                {option.sub}
              </p>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <Button
          size="md"
          className="w-full"
          disabled={selected.size === 0}
          onClick={() => onConfirm(Array.from(selected))}
        >
          continuar →
        </Button>

        <div className="flex justify-between items-center">
          <button
            onClick={onBack}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← atrás
          </button>
          <button
            onClick={onSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            empezar vacío →
          </button>
        </div>
      </div>
    </div>
  );
}
