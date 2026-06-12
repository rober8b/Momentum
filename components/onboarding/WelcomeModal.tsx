'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Dialog } from '@base-ui/react';
import { LayoutGrid, GraduationCap, Briefcase, FolderKanban, Rocket, Users, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { completeOnboarding } from '@/app/onboarding/actions';
import { t } from '@/lib/strings';
import type { Lang, StringKey } from '@/lib/strings';

const PILLARS: { icon: typeof LayoutGrid; navKey: StringKey; descKey: StringKey }[] = [
  { icon: LayoutGrid, navKey: 'navToday', descKey: 'onboardingPillarToday' },
  { icon: GraduationCap, navKey: 'navUni', descKey: 'onboardingPillarUni' },
  { icon: Briefcase, navKey: 'navWork', descKey: 'onboardingPillarWork' },
  { icon: FolderKanban, navKey: 'navFreelance', descKey: 'onboardingPillarFreelance' },
  { icon: Rocket, navKey: 'navProjects', descKey: 'onboardingPillarProjects' },
  { icon: Users, navKey: 'navCommunity', descKey: 'onboardingPillarCommunity' },
  { icon: Megaphone, navKey: 'navBuild', descKey: 'onboardingPillarBuild' },
];

export function WelcomeModal({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(true);
  const [, startTransition] = useTransition();

  function dismiss() {
    setOpen(false);
    startTransition(() => {
      completeOnboarding();
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && dismiss()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-foreground">
            {t('onboardingWelcomeTitle', lang)}
          </Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">
            {t('onboardingWelcomeDescription', lang)}
          </Dialog.Description>

          <p className="mt-5 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            {t('onboardingPillarsTitle', lang)}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PILLARS.map(({ icon: Icon, navKey, descKey }) => (
              <div key={navKey} className="rounded-lg border border-border bg-surface-elev p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Icon size={14} className="text-accent" />
                  <span className="text-sm font-medium capitalize">{t(navKey, lang)}</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{t(descKey, lang)}</p>
              </div>
            ))}
          </div>

          <Link
            href="/settings/api-tokens"
            onClick={dismiss}
            className="mt-4 block rounded-lg border border-border bg-surface-elev p-3 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
          >
            {t('onboardingVaultCta', lang)}
          </Link>

          <div className="mt-5 flex justify-end">
            <Button onClick={dismiss}>{t('onboardingGetStarted', lang)}</Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
