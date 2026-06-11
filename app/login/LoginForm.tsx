'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { loginAction, type LoginState } from './actions';

const initial: LoginState = {};

type Props = {
  next: string;
  providers: { github: boolean; google: boolean };
  oauthError: string | null;
};

export function LoginForm({ next, providers, oauthError }: Props) {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      <OAuthButtons providers={providers} next={next} lang="es" />
      {oauthError && <p className="text-xs text-danger text-center">{oauthError}</p>}
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
      <p className="text-xs text-muted-foreground text-center">
        <Link href="/forgot-password" className="text-accent hover:underline">
          olvidé mi contraseña
        </Link>
      </p>
    </form>
  );
}
