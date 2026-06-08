// Next.js 16: middleware deprecated → use proxy.ts.
// Verifies the session cookie (format: "userId.iat.hmac") using Web Crypto (Edge runtime).
// If invalid and the route is not public, redirects to /login.

import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_NAME = 'cc_session';

const PUBLIC_PATHS = ['/', '/login', '/setup', '/forgot-password', '/reset-password', '/verify-email'];
const CRON_PATHS = ['/api/export'];

function base64UrlEncode(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Cookie: "{userId}.{iat}.{hmac(userId.iat)}"
// Splits off the last dot → payload = "userId.iat", sig = hmac.
async function verifySession(signed: string | undefined, secret: string): Promise<boolean> {
  if (!signed) return false;
  const lastDot = signed.lastIndexOf('.');
  if (lastDot < 0) return false;
  const payload = signed.slice(0, lastDot);
  const sig = signed.slice(lastDot + 1);
  // payload must contain at least one dot (userId.iat)
  if (!payload.includes('.')) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
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
  return CRON_PATHS.some((p) => pathname === p);
}

function isSignup(pathname: string): boolean {
  return pathname === '/signup' || pathname.startsWith('/signup/');
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow ALLOW_SIGNUP route when env var is set
  if (isSignup(pathname)) {
    if (process.env.ALLOW_SIGNUP === 'true') return NextResponse.next();
    return new NextResponse(null, { status: 404 });
  }

  if (isCron(pathname) || isPublic(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('SESSION_SECRET not configured', { status: 500 });
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
