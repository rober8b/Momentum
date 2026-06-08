'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ALL_SCOPES } from '@/lib/types';
import type { ApiScope } from '@/lib/types';
import { createApiToken } from '@/app/settings/api-tokens/actions';

type Props = {
  onCreated: (fullToken: string) => void;
  onCancel: () => void;
};

const SCOPE_LABELS: Record<ApiScope, string> = {
  'projects:write': 'proyectos',
  'uni:write': 'uni',
  'work:write': 'work',
  'community:write': 'comunidad',
  'freelance:write': 'freelance',
  'build:write': 'build',
  'organizations:write': 'organizaciones',
};

function defaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  // format as datetime-local value: YYYY-MM-DDTHH:mm
  return d.toISOString().slice(0, 16);
}

export function ApiTokenForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiScope[]>([]);
  const [expiresAt, setExpiresAt] = useState<string>(defaultExpiry());
  const [noExpiry, setNoExpiry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleScope(scope: ApiScope) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('el nombre es requerido');
      return;
    }
    if (scopes.length === 0) {
      setError('seleccioná al menos un scope');
      return;
    }
    setError(null);

    const expiresAtISO = noExpiry ? null : new Date(expiresAt).toISOString();

    startTransition(async () => {
      try {
        const { fullToken } = await createApiToken({
          name: name.trim(),
          scopes,
          expiresAt: expiresAtISO,
        });
        onCreated(fullToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'error al crear el token');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground" htmlFor="token-name">
          nombre
        </label>
        <input
          id="token-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ej: momentum-mcp"
          maxLength={100}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">scopes</p>
        <div className="flex flex-wrap gap-2">
          {ALL_SCOPES.map((scope) => {
            const active = scopes.includes(scope);
            return (
              <button
                key={scope}
                type="button"
                onClick={() => toggleScope(scope)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-accent/15 text-accent border-accent/40'
                    : 'bg-surface-elev text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                {SCOPE_LABELS[scope]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">expiración</p>
        <div className="flex items-center gap-3">
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            disabled={noExpiry}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={noExpiry}
              onChange={(e) => setNoExpiry(e.target.checked)}
              className="rounded"
            />
            sin expiración
          </label>
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'generando...' : 'generar token'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          cancelar
        </Button>
      </div>
    </form>
  );
}
