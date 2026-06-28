'use client';

import type { OnboardingContext } from '../types';

const OPTIONS: { key: OnboardingContext; label: string; sub: string }[] = [
  { key: 'student',   label: 'principalmente estudiante',         sub: 'facu como eje central' },
  { key: 'developer', label: 'trabajo en empresa',                sub: 'en relación de dependencia' },
  { key: 'freelancer',label: 'trabajo con clientes propios',      sub: 'freelance o consultoría' },
  { key: 'builder',   label: 'construyo proyectos y comparto',    sub: 'side projects y contenido online' },
  { key: 'mix',       label: 'una mezcla de todo',                sub: 'varios roles a la vez' },
];

type Props = {
  onSelect: (context: OnboardingContext) => void;
  onSkip: () => void;
};

export function StepContext({ onSelect, onSkip }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">¿cómo es tu semana típica?</h2>
        <p className="text-sm text-muted-foreground mt-1">elegí la que más se acerca</p>
      </div>

      <div className="flex flex-col gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => onSelect(option.key)}
            className="text-left rounded-xl border border-border bg-surface-elev px-4 py-3 hover:border-accent hover:bg-accent/5 transition-colors group"
          >
            <p className="text-sm font-medium group-hover:text-accent transition-colors">
              {option.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{option.sub}</p>
          </button>
        ))}
      </div>

      <button
        onClick={onSkip}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center pt-1"
      >
        prefiero empezar vacío →
      </button>
    </div>
  );
}
