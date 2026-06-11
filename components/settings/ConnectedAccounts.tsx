'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { GithubIcon, GoogleIcon } from '@/components/auth/OAuthIcons';
import { useToast } from '@/lib/hooks/useToast';
import { unlinkOAuthAccount } from '@/app/settings/profile/actions';
import { t, type Lang } from '@/lib/strings';
import type { OAuthProvider } from '@/lib/types';

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  github: 'GitHub',
  google: 'Google',
};

const PROVIDER_ICONS: Record<OAuthProvider, typeof GithubIcon> = {
  github: GithubIcon,
  google: GoogleIcon,
};

type Props = {
  connectedProviders: OAuthProvider[];
  hasPassword: boolean;
  configuredProviders: { github: boolean; google: boolean };
  lang: Lang;
};

function ProviderRow({
  provider,
  connected,
  configured,
  canUnlink,
  lang,
}: {
  provider: OAuthProvider;
  connected: boolean;
  configured: boolean;
  canUnlink: boolean;
  lang: Lang;
}) {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const Icon = PROVIDER_ICONS[provider];

  function handleUnlink() {
    startTransition(async () => {
      const result = await unlinkOAuthAccount({ provider });
      if (result.error === 'last_method') {
        toast.error(t('accountsLastMethodError', lang));
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">{PROVIDER_LABELS[provider]}</p>
          <Badge variant={connected ? 'success' : 'muted'}>
            {connected ? t('accountsConnected', lang) : t('accountsNotConnected', lang)}
          </Badge>
        </div>
      </div>
      {connected ? (
        canUnlink && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
            className="text-xs text-muted-foreground hover:text-danger transition-colors"
          >
            {t('accountsDisconnect', lang)}
          </button>
        )
      ) : (
        configured && (
          <a
            href={`/api/auth/${provider}?next=/settings/profile`}
            className="text-xs text-accent hover:underline"
          >
            {t('accountsConnect', lang)}
          </a>
        )
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleUnlink}
        title={t('accountsUnlinkConfirmTitle', lang)}
        description={t('accountsUnlinkConfirmDescription', lang)}
        confirmLabel={t('accountsDisconnect', lang)}
        variant="danger"
      />
    </div>
  );
}

export function ConnectedAccounts({ connectedProviders, hasPassword, configuredProviders, lang }: Props) {
  const providers: OAuthProvider[] = ['github', 'google'];
  const canUnlink = hasPassword || connectedProviders.length > 1;

  return (
    <div className="space-y-3">
      {providers.map((provider) => (
        <ProviderRow
          key={provider}
          provider={provider}
          connected={connectedProviders.includes(provider)}
          configured={configuredProviders[provider]}
          canUnlink={canUnlink}
          lang={lang}
        />
      ))}
    </div>
  );
}
