'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { forgotPasswordAction, type ForgotState } from './actions';

const initial: ForgotState = {};

export function ForgotForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initial);

  if (state?.done) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm">
          si ese email existe, te enviamos un link para resetear tu contraseña.
        </p>
        <p className="text-xs text-muted-foreground">
          revisá tu bandeja de entrada (y spam).
        </p>
        <Link href="/login" className="text-xs text-accent hover:underline block mt-4">
          volver al login →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input
        type="email"
        name="email"
        autoFocus
        autoComplete="email"
        placeholder="email"
        required
        className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
      />
      {state?.error && (
        <p className="text-xs text-danger">{state.error}</p>
      )}
      <Button type="submit" size="md" disabled={pending} className="w-full">
        {pending ? 'enviando…' : 'enviar link'}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        <Link href="/login" className="text-accent hover:underline">
          volver al login
        </Link>
      </p>
    </form>
  );
}
