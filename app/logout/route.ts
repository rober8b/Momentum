import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'));
}

// También aceptamos GET para que el link en el sidebar funcione sin form
export async function GET() {
  return POST();
}
