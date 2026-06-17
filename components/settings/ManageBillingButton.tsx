'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/hooks/useToast';
import { openCustomerPortal } from '@/app/settings/billing/actions';
import { t, type Lang } from '@/lib/strings';

export function ManageBillingButton({ lang }: { lang: Lang }) {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function handleManage() {
    startTransition(async () => {
      const result = await openCustomerPortal();
      if (result?.error) {
        toast.error(t('billingNotConfigured', lang));
      }
    });
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleManage} disabled={isPending}>
      {t('billingManage', lang)}
    </Button>
  );
}
