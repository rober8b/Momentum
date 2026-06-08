'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type Props = {
  token: string;
  onDismiss: () => void;
};

export function NewTokenDisplay({ token, onDismiss }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyToken() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/8 p-4 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">token generado</p>
        <p className="text-xs text-warning">
          guardá este token ahora. no vas a poder verlo de nuevo.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-md bg-surface border border-border px-3 py-2 text-xs font-mono text-foreground break-all">
          {token}
        </code>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={copyToken}
          className="shrink-0"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'copiado' : 'copiar'}
        </Button>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        className="w-full text-muted-foreground"
      >
        entendido, ya lo guardé
      </Button>
    </div>
  );
}
