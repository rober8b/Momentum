'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { signupAction, type SignupState } from './actions';

const initial: SignupState = {};

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'New York (UTC-5)' },
  { value: 'America/Chicago', label: 'Chicago (UTC-6)' },
  { value: 'America/Denver', label: 'Denver (UTC-7)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (UTC-3)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (UTC-3)' },
  { value: 'America/Bogota', label: 'Bogotá (UTC-5)' },
  { value: 'America/Mexico_City', label: 'Ciudad de México (UTC-6)' },
  { value: 'America/Santiago', label: 'Santiago (UTC-4)' },
  { value: 'Europe/London', label: 'London (UTC+0)' },
  { value: 'Europe/Madrid', label: 'Madrid (UTC+1)' },
  { value: 'Europe/Berlin', label: 'Berlin (UTC+1)' },
  { value: 'Europe/Paris', label: 'Paris (UTC+1)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (UTC+8)' },
  { value: 'Asia/Kolkata', label: 'Kolkata (UTC+5:30)' },
  { value: 'Asia/Dubai', label: 'Dubai (UTC+4)' },
  { value: 'Australia/Sydney', label: 'Sydney (UTC+10)' },
  { value: 'Pacific/Auckland', label: 'Auckland (UTC+12)' },
];

type Props = {
  providers: { github: boolean; google: boolean };
};

export function SignupForm({ providers }: Props) {
  const [state, formAction, pending] = useActionState(signupAction, initial);

  if (state?.pendingVerification) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm">cuenta creada.</p>
        <p className="text-xs text-muted-foreground">
          revisá tu email para confirmar tu cuenta antes de entrar.
        </p>
        <Link href="/login" className="text-xs text-accent hover:underline block mt-4">
          ir al login →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <OAuthButtons providers={providers} next="/" lang="es" />
      {/* Honeypot — hidden from real users, filled by bots */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ display: 'none' }}
      />

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
        type="text"
        name="display_name"
        autoComplete="name"
        placeholder="nombre para mostrar"
        required
        className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
      />
      <input
        type="password"
        name="password"
        autoComplete="new-password"
        placeholder="contraseña (mín. 8 caracteres)"
        required
        minLength={8}
        className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
      />
      <select
        name="timezone"
        defaultValue="UTC"
        className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
      >
        {TIMEZONES.map((tz) => (
          <option key={tz.value} value={tz.value}>{tz.label}</option>
        ))}
      </select>
      {state?.error && (
        <p className="text-xs text-danger">{state.error}</p>
      )}
      <Button type="submit" size="md" disabled={pending} className="w-full">
        {pending ? 'creando cuenta…' : 'crear cuenta'}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        ¿ya tenés cuenta?{' '}
        <Link href="/login" className="text-accent hover:underline">
          entrar
        </Link>
      </p>
    </form>
  );
}
