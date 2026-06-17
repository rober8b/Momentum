'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/hooks/useToast';
import { createCheckoutSession } from '@/app/settings/billing/actions';
import { t, type Lang } from '@/lib/strings';

export function UpgradeButton({ lang }: { lang: Lang }) {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function handleUpgrade() {
    startTransition(async () => {
      const result = await createCheckoutSession();
      if (result?.error) {
        toast.error(t('billingNotConfigured', lang));
      }
    });
  }

  return (
    <Button size="sm" onClick={handleUpgrade} disabled={isPending}>
      {t('planUpgrade', lang)}
    </Button>
  );
}
