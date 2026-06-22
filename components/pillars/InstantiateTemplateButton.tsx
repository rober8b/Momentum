'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { instantiateTemplate } from '@/app/p/actions';
import { useToast } from '@/lib/hooks/useToast';
import type { PillarTemplate } from '@/lib/pillar-templates';

// Dev-only trigger for Sprint B Phase 1 — real onboarding will instantiate
// templates as part of a generative flow, not a button. See
// docs/DYNAMIC_PILLARS.md phase 5+.
export function InstantiateTemplateButton({ template }: { template: PillarTemplate }) {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function handleClick() {
    startTransition(async () => {
      const result = await instantiateTemplate(template.key);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Button size="sm" onClick={handleClick} disabled={isPending}>
      instanciar {template.name}
    </Button>
  );
}
