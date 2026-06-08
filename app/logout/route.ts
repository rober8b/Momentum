import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_NAME, verifySession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST() {
  const store = await cookies();
  const signed = store.get(COOKIE_NAME)?.value;
  if (signed) {
    const session = verifySession(signed);
    if (session) logAudit({ userId: session.userId, action: 'logout' });
  }
  store.delete(COOKIE_NAME);
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'));
}

// También aceptamos GET para que el link en el sidebar funcione sin form
export async function GET() {
  return POST();
}
