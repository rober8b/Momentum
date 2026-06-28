'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import type { OnboardingAnswers, ProposedPillar } from '../types';
import { inferStructure } from '../inference';
import { materializeOnboarding } from '../actions';
import { PillarPreviewCard } from '../components/PillarPreviewCard';

type Props = {
  answers: OnboardingAnswers;
  onBack: () => void;
  onDone: () => void;
};

export function StepPreview({ answers, onBack, onDone }: Props) {
  const [pillars, setPillars] = useState<ProposedPillar[]>(
    () => inferStructure(answers).pillars,
  );
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function updatePillar(templateKey: string, updated: ProposedPillar | null) {
    setPillars((prev) =>
      updated === null
        ? prev.filter((p) => p.templateKey !== templateKey)
        : prev.map((p) => (p.templateKey === templateKey ? updated : p)),
    );
  }

  function handleConfirm() {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await materializeOnboarding({ pillars });
      if (result.ok) {
        onDone();
      } else {
        setErrorMsg(
          result.error === 'plan_limit'
            ? 'llegaste al límite del plan — eliminá algunos items e intentá de nuevo'
            : 'algo salió mal — intentá de nuevo',
        );
      }
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
          tu punto de partida
        </p>
        <h2 className="text-xl font-semibold mt-1">así va a quedar tu Momentum</h2>
        <p className="text-sm text-muted-foreground mt-1">
          editá lo que quieras antes de confirmar
        </p>
      </div>

      {pillars.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          eliminaste todos los pilares — vas a arrancar con un espacio vacío.
        </p>
      ) : (
        <div className="space-y-2.5">
          {pillars.map((pillar) => (
            <PillarPreviewCard
              key={pillar.templateKey}
              pillar={pillar}
              onChange={(updated) => updatePillar(pillar.templateKey, updated)}
            />
          ))}
        </div>
      )}

      <div className="space-y-3">
        {errorMsg && (
          <p className="text-xs text-danger text-center">{errorMsg}</p>
        )}

        <Button size="md" className="w-full" onClick={handleConfirm} disabled={isPending}>
          {isPending ? 'configurando…' : 'así quiero empezar →'}
        </Button>

        <button
          onClick={onBack}
          disabled={isPending}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center disabled:opacity-40"
        >
          ← atrás
        </button>
      </div>
    </div>
  );
}
