import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ApiTokenManager } from '@/components/settings/ApiTokenManager';
import type { ApiToken } from '@/lib/types';

export const dynamic = 'force-dynamic';

function rowToApiToken(row: typeof schema.apiTokens.$inferSelect): ApiToken {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    token_prefix: row.token_prefix,
    scopes: Array.isArray(row.scopes) ? (row.scopes as ApiToken['scopes']) : [],
    last_used_at: row.last_used_at ? row.last_used_at.toISOString() : null,
    expires_at: row.expires_at ? row.expires_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
    revoked_at: row.revoked_at ? row.revoked_at.toISOString() : null,
  };
}

export default async function ApiTokensPage() {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(schema.apiTokens)
    .where(eq(schema.apiTokens.user_id, user.id))
    .orderBy(desc(schema.apiTokens.created_at));

  const tokens = rows.map(rowToApiToken);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">api tokens</h1>
        <p className="text-sm text-muted-foreground">
          tokens para integrar momentum con el servidor MCP u otras herramientas externas.
          cada token solo se muestra una vez al generarlo.
        </p>
      </div>
      <ApiTokenManager tokens={tokens} />
    </div>
  );
}
