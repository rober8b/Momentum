'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { OnboardingArea, OnboardingDetail, SubjectCount, ClientCount } from '../types';

const SUBJECT_OPTIONS: { key: SubjectCount; label: string }[] = [
  { key: 'low',  label: '1 o 2 materias' },
  { key: 'mid',  label: '3 o 4 materias' },
  { key: 'high', label: '5 o más' },
];

const CLIENT_OPTIONS: { key: ClientCount; label: string }[] = [
  { key: 'one',  label: '1 cliente' },
  { key: 'few',  label: '2 o 3 clientes' },
  { key: 'many', label: '4 o más' },
];

type Props = {
  areas: OnboardingArea[];
  onConfirm: (detail: OnboardingDetail) => void;
  onBack: () => void;
  onSkip: () => void;
};

export function StepDetail({ areas, onConfirm, onBack, onSkip }: Props) {
  const needsUni = areas.includes('uni');
  const needsFreelance = areas.includes('freelance');

  const [subjectCount, setSubjectCount] = useState<SubjectCount | undefined>();
  const [clientCount, setClientCount] = useState<ClientCount | undefined>();

  const canContinue =
    (!needsUni || subjectCount !== undefined) &&
    (!needsFreelance || clientCount !== undefined);

  function handleConfirm() {
    onConfirm({ subjectCount, clientCount });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">un detalle rápido</h2>
        <p className="text-sm text-muted-foreground mt-1">
          para armar mejor tu punto de partida
        </p>
      </div>

      <div className="space-y-6">
        {needsUni && (
          <div className="space-y-2">
            <p className="text-sm font-medium">¿cuántas materias estás cursando?</p>
            <div className="flex flex-col gap-1.5">
              {SUBJECT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSubjectCount(opt.key)}
                  className={[
                    'text-left rounded-lg border px-3 py-2.5 text-sm transition-colors',
                    subjectCount === opt.key
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-surface-elev hover:border-accent/50',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {needsFreelance && (
          <div className="space-y-2">
            <p className="text-sm font-medium">¿cuántos clientes activos manejás?</p>
            <div className="flex flex-col gap-1.5">
              {CLIENT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setClientCount(opt.key)}
                  className={[
                    'text-left rounded-lg border px-3 py-2.5 text-sm transition-colors',
                    clientCount === opt.key
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-surface-elev hover:border-accent/50',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Button
          size="md"
          className="w-full"
          disabled={!canContinue}
          onClick={handleConfirm}
        >
          ver mi propuesta →
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
