'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, passwordMatches, signSession, SESSION_COOKIE_OPTIONS } from '@/lib/auth';

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/');

  if (!passwordMatches(password)) {
    return { error: 'password incorrecta' };
  }

  const store = await cookies();
  store.set(COOKIE_NAME, signSession(), {
    ...SESSION_COOKIE_OPTIONS,
    secure: process.env.NODE_ENV === 'production',
  });

  // Validar que next es interno (evitar open redirect)
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  redirect(safeNext);
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  redirect('/login');
}
