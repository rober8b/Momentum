// Next.js 16: middleware deprecado → usar proxy.ts.
// Verifica la cookie 'cc_session' usando Web Crypto (compatible con Edge runtime).
// Si no es válida y la ruta no es pública, redirige a /login.

import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_NAME = 'cc_session';
const COOKIE_PAYLOAD = 'ok';

const PUBLIC_PATHS = ['/login'];
const CRON_PATHS = ['/api/export'];

function base64UrlEncode(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function verifySession(signed: string | undefined, secret: string): Promise<boolean> {
  if (!signed) return false;
  const dot = signed.indexOf('.');
  if (dot < 0) return false;
  const value = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  if (value !== COOKIE_PAYLOAD) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  const expected = base64UrlEncode(sigBuf);

  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isCron(pathname: string): boolean {
  // El cron de Vercel se autentica con header CRON_SECRET — el handler valida.
  return CRON_PATHS.some((p) => pathname === p);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isCron(pathname) || isPublic(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Sin secret no se puede verificar — fallar cerrado en prod.
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('SESSION_SECRET no configurado', { status: 500 });
    }
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const ok = await verifySession(cookie, secret);

  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
