'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ApiTokenList } from './ApiTokenList';
import { ApiTokenForm } from './ApiTokenForm';
import { NewTokenDisplay } from './NewTokenDisplay';
import type { ApiToken } from '@/lib/types';

type Props = {
  tokens: ApiToken[];
};

export function ApiTokenManager({ tokens }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  function handleCreated(fullToken: string) {
    setShowForm(false);
    setNewToken(fullToken);
  }

  return (
    <div className="space-y-6">
      {newToken && (
        <NewTokenDisplay token={newToken} onDismiss={() => setNewToken(null)} />
      )}

      {showForm ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-medium text-foreground mb-4">nuevo token</p>
          <ApiTokenForm
            onCreated={handleCreated}
            onCancel={() => setShowForm(false)}
          />
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowForm(true)}
          disabled={!!newToken}
        >
          <Plus size={14} />
          generar nuevo token
        </Button>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-foreground">tokens existentes</h2>
        <ApiTokenList tokens={tokens} />
      </div>
    </div>
  );
}
