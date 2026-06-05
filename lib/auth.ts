// Auth simple para single-user — password + cookie HMAC-firmada.
// Sin servicios externos. La password vive en APP_PASSWORD (env).
// El secret para firmar las cookies vive en SESSION_SECRET (env).
//
// Flujo:
//   1) /login — POST password → si matchea, set cookie 'cc_session' firmada
//   2) Server components/actions llaman `requireRober()` que verifica la firma
//   3) proxy.ts (Edge) hace verify-light + redirect a /login si no hay cookie válida
//
// El proxy usa Web Crypto (Edge), este archivo usa node:crypto (Server Components).

import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE_NAME = 'cc_session';
const COOKIE_PAYLOAD = 'ok';
const MAX_AGE_DAYS = 30;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET no está configurado (mínimo 16 chars)');
  }
  return s;
}

function hmacBase64Url(value: string): string {
  return createHmac('sha256', getSecret()).update(value).digest('base64url');
}

export function signSession(): string {
  return `${COOKIE_PAYLOAD}.${hmacBase64Url(COOKIE_PAYLOAD)}`;
}

export function verifySession(signed: string | undefined): boolean {
  if (!signed) return false;
  const dot = signed.indexOf('.');
  if (dot < 0) return false;
  const value = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  if (value !== COOKIE_PAYLOAD) return false;
  let expected: string;
  try {
    expected = hmacBase64Url(value);
  } catch {
    return false;
  }
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function isAuthed(): Promise<boolean> {
  const store = await cookies();
  return verifySession(store.get(COOKIE_NAME)?.value);
}

/**
 * Llamar al top de cada server component / server action protegido.
 * Lanza si la cookie no es válida. El proxy.ts ya redirige a /login
 * antes de que llegue acá, pero esto es la defensa en profundidad.
 */
export async function requireRober(): Promise<void> {
  if (!(await isAuthed())) {
    throw new Error('NOT_SIGNED_IN');
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * MAX_AGE_DAYS,
};
