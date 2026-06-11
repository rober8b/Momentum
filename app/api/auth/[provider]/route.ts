import { NextResponse } from 'next/server';
import {
  buildAuthorizeUrl,
  generateState,
  getOAuthConfig,
  isOAuthProvider,
  setOAuthStateCookie,
} from '@/lib/oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;

  if (!isOAuthProvider(provider)) {
    return new NextResponse(null, { status: 404 });
  }

  const config = getOAuthConfig(provider);
  if (!config) {
    const url = new URL('/login', request.url);
    url.searchParams.set('error', 'oauth_not_configured');
    return NextResponse.redirect(url);
  }

  const requestUrl = new URL(request.url);
  const nextParam = requestUrl.searchParams.get('next') ?? '/';
  const safeNext = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

  const state = generateState();
  await setOAuthStateCookie(provider, state, safeNext);

  return NextResponse.redirect(buildAuthorizeUrl(provider, config, state));
}
