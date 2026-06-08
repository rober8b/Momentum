'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { loginAction, type LoginState } from './actions';

const initial: LoginState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <input
        type="email"
        name="email"
        autoFocus
        autoComplete="email"
        placeholder="email"
        required
        className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
      />
      <input
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder="contraseña"
        required
        className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
      />
      {state?.error && (
        <p className="text-xs text-danger">{state.error}</p>
      )}
      <Button type="submit" size="md" disabled={pending} className="w-full">
        {pending ? 'verificando…' : 'entrar'}
      </Button>
    </form>
  );
}
