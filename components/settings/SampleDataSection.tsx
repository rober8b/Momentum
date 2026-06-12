'use client';

import { useState, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/lib/hooks/useToast';
import { loadSampleData, removeSampleData } from '@/app/settings/sample-data/actions';
import { t, type Lang } from '@/lib/strings';

export function SampleDataSection({ hasSampleData, lang }: { hasSampleData: boolean; lang: Lang }) {
  const [loaded, setLoaded] = useState(hasSampleData);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function handleLoad() {
    startTransition(async () => {
      const result = await loadSampleData();
      if (result.alreadyLoaded) {
        toast.info(t('sampleDataAlreadyLoaded', lang));
      } else if (result.skipped?.length) {
        toast.info(t('sampleDataLoadedPartial', lang));
      } else {
        toast.success(t('sampleDataLoaded', lang));
      }
      setLoaded(true);
    });
  }

  function handleRemove() {
    startTransition(async () => {
      await removeSampleData();
      toast.success(t('sampleDataRemoved', lang));
      setLoaded(false);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sampleDataTitle', lang)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('sampleDataDescription', lang)}</p>
        {loaded ? (
          <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(true)} disabled={isPending}>
            {t('sampleDataRemove', lang)}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={handleLoad} disabled={isPending}>
            {t('sampleDataLoad', lang)}
          </Button>
        )}
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleRemove}
          title={t('sampleDataRemoveConfirmTitle', lang)}
          description={t('sampleDataRemoveConfirmDescription', lang)}
          confirmLabel={t('sampleDataRemove', lang)}
          variant="danger"
        />
      </CardContent>
    </Card>
  );
}
