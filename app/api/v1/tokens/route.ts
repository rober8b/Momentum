import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/auth';
import { generateToken } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { ALL_SCOPES } from '@/lib/types';

export const dynamic = 'force-dynamic';

const CreateTokenSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(ALL_SCOPES as [string, ...string[]])).min(1),
  expires_at: z.string().datetime().optional(),
});

function parseCookieHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key?.trim() === name) return rest.join('=').trim();
  }
  return undefined;
}

export async function POST(request: Request) {
  try {
    // Auth via session cookie
    const cookieHeader = request.headers.get('cookie');
    const signed = parseCookieHeader(cookieHeader, COOKIE_NAME);
    const session = verifySession(signed);
    if (!session) {
      return Response.json({ error: 'Authentication required', code: 'unauthenticated' }, { status: 401 });
    }

    const [userRow] = await db
      .select({ id: schema.users.id, active: schema.users.active })
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1);

    if (!userRow || !userRow.active) {
      return Response.json({ error: 'Authentication required', code: 'unauthenticated' }, { status: 401 });
    }

    // Per-user session invalidation check
    const [fullUser] = await db
      .select({ invalidate_sessions_before: schema.users.invalidate_sessions_before })
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1);

    if (fullUser?.invalidate_sessions_before && session.iat < fullUser.invalidate_sessions_before) {
      return Response.json({ error: 'Session expired', code: 'unauthenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = CreateTokenSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { name, scopes, expires_at } = parsed.data;
    const { token, hash, prefix } = generateToken();

    const [row] = await db
      .insert(schema.apiTokens)
      .values({
        user_id: userRow.id,
        name,
        token_hash: hash,
        token_prefix: prefix,
        scopes: scopes as typeof ALL_SCOPES,
        expires_at: expires_at ? new Date(expires_at) : null,
      })
      .returning({ id: schema.apiTokens.id, expires_at: schema.apiTokens.expires_at });

    if (!row) {
      return Response.json({ error: 'Failed to create token', code: 'internal_error' }, { status: 500 });
    }

    logAudit({ userId: userRow.id, action: 'api_token_created', entityId: row.id });

    return Response.json(
      {
        token,
        id: row.id,
        prefix,
        expires_at: row.expires_at ? row.expires_at.toISOString() : null,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/v1/tokens]', err);
    return Response.json({ error: 'Internal server error', code: 'internal_error' }, { status: 500 });
  }
}
