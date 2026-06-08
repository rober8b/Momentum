'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { resetPasswordAction, type ResetState } from './actions';

const initial: ResetState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <input
        type="password"
        name="password"
        autoFocus
        autoComplete="new-password"
        placeholder="nueva contraseña (mín. 8 caracteres)"
        required
        minLength={8}
        className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
      />
      {state?.error && (
        <p className="text-xs text-danger">{state.error}</p>
      )}
      <Button type="submit" size="md" disabled={pending} className="w-full">
        {pending ? 'guardando…' : 'guardar contraseña'}
      </Button>
    </form>
  );
}
