import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { DEFAULT_USER_SETTINGS } from '@/lib/types';
import {
  consumeOAuthStateCookie,
  exchangeCodeForToken,
  fetchOAuthProfile,
  getOAuthConfig,
  isOAuthProvider,
  OAuthError,
  statesMatch,
} from '@/lib/oauth';

export const dynamic = 'force-dynamic';

function loginError(request: Request, code: string): NextResponse {
  const url = new URL('/login', request.url);
  url.searchParams.set('error', code);
  return NextResponse.redirect(url);
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isOAuthProvider(provider)) return new NextResponse(null, { status: 404 });

  const config = getOAuthConfig(provider);
  if (!config) return loginError(request, 'oauth_not_configured');

  const requestUrl = new URL(request.url);
  const providerError = requestUrl.searchParams.get('error');
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');

  const stored = await consumeOAuthStateCookie(provider);

  if (providerError) return loginError(request, 'oauth_denied');
  if (!code || !state || !stored || !statesMatch(state, stored.state)) {
    return loginError(request, 'oauth_state_mismatch');
  }

  let userId: string;
  try {
    const accessToken = await exchangeCodeForToken(provider, config, code);
    const profile = await fetchOAuthProfile(provider, accessToken);

    const [existingAccount] = await db
      .select({ user_id: schema.oauthAccounts.user_id })
      .from(schema.oauthAccounts)
      .where(
        and(
          eq(schema.oauthAccounts.provider, provider),
          eq(schema.oauthAccounts.provider_account_id, profile.providerAccountId),
        ),
      )
      .limit(1);

    if (existingAccount) {
      userId = existingAccount.user_id;
      logAudit({ userId, action: 'oauth_login', metadata: { provider } });
    } else {
      const existingUser = profile.email
        ? (
            await db
              .select({ id: schema.users.id, active: schema.users.active })
              .from(schema.users)
              .where(eq(schema.users.email, profile.email))
              .limit(1)
          )[0]
        : undefined;

      if (existingUser) {
        if (!existingUser.active) return loginError(request, 'account_disabled');

        userId = existingUser.id;
        await db.insert(schema.oauthAccounts).values({
          user_id: userId,
          provider,
          provider_account_id: profile.providerAccountId,
        });
        logAudit({ userId, action: 'oauth_account_linked', metadata: { provider } });
        logAudit({ userId, action: 'oauth_login', metadata: { provider } });
      } else {
        if (process.env.ALLOW_SIGNUP !== 'true') {
          return loginError(request, 'signup_disabled');
        }

        const email = profile.email ?? `${provider}_${profile.providerAccountId}@users.noreply.momentum`;
        const [newUser] = await db
          .insert(schema.users)
          .values({
            email,
            display_name: profile.name,
            password_hash: null,
            role: 'member',
            active: true,
            settings: DEFAULT_USER_SETTINGS,
          })
          .returning({ id: schema.users.id });

        if (!newUser) return loginError(request, 'oauth_failed');

        userId = newUser.id;
        await db.insert(schema.oauthAccounts).values({
          user_id: userId,
          provider,
          provider_account_id: profile.providerAccountId,
        });
        logAudit({ userId, action: 'oauth_signup', metadata: { provider } });
      }
    }
  } catch (err) {
    const code = err instanceof OAuthError ? err.code : 'oauth_failed';
    console.error(`[oauth/${provider}]`, err);
    return loginError(request, code);
  }

  await db.update(schema.users).set({ last_login_at: new Date() }).where(eq(schema.users.id, userId));
  await createSession(userId);

  return NextResponse.redirect(new URL(stored.next, request.url));
}
