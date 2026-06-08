'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { revokeApiToken } from '@/app/settings/api-tokens/actions';
import type { ApiToken, ApiScope } from '@/lib/types';

const SCOPE_LABELS: Record<ApiScope, string> = {
  'projects:write': 'proyectos',
  'uni:write': 'uni',
  'work:write': 'work',
  'community:write': 'comunidad',
  'freelance:write': 'freelance',
  'build:write': 'build',
  'organizations:write': 'organizaciones',
};

function formatDate(iso: string | null): string {
  if (!iso) return 'nunca';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function TokenRow({ token }: { token: ApiToken }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [, startTransition] = useTransition();

  const isRevoked = !!token.revoked_at;
  const isExpired = !!token.expires_at && new Date(token.expires_at) < new Date();

  function handleRevoke() {
    startTransition(async () => {
      await revokeApiToken(token.id);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">{token.name}</p>
          <code className="text-xs text-muted-foreground font-mono">{token.token_prefix}…</code>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRevoked && <Badge variant="danger">revocado</Badge>}
          {!isRevoked && isExpired && <Badge variant="warning">expirado</Badge>}
          {!isRevoked && !isExpired && <Badge variant="success">activo</Badge>}
          {!isRevoked && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="text-xs text-muted-foreground hover:text-danger transition-colors"
            >
              revocar
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {(token.scopes as ApiScope[]).map((scope) => (
          <Badge key={scope} variant="muted">
            {SCOPE_LABELS[scope] ?? scope}
          </Badge>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>creado {formatDate(token.created_at)}</span>
        <span>último uso: {formatDate(token.last_used_at)}</span>
        <span>expira: {token.expires_at ? formatDate(token.expires_at) : 'nunca'}</span>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRevoke}
        title="¿revocar token?"
        description={`El token "${token.name}" dejará de funcionar de inmediato.`}
        confirmLabel="revocar"
        variant="danger"
      />
    </div>
  );
}

type Props = {
  tokens: ApiToken[];
};

export function ApiTokenList({ tokens }: Props) {
  if (tokens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        no hay tokens. generá uno para empezar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {tokens.map((token) => (
        <TokenRow key={token.id} token={token} />
      ))}
    </div>
  );
}
