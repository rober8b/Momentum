import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireApiToken, ApiAuthError } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const itemSchema = z.object({
  organization_name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['pending', 'done', 'cancelled']).default('pending'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

const importSchema = z.object({
  items: z.array(itemSchema).min(1).max(200),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 80);
}

export async function POST(request: Request) {
  try {
    const { userId, tokenId } = await requireApiToken(request, ['community:write', 'organizations:write']);

    const body = await request.json().catch(() => null);
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const imported: string[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    const orgCache = new Map<string, string>(); // name -> id

    for (let i = 0; i < parsed.data.items.length; i++) {
      const item = parsed.data.items[i];
      try {
        let orgId = orgCache.get(item.organization_name);
        if (!orgId) {
          const [existing] = await db
            .select({ id: schema.organizations.id })
            .from(schema.organizations)
            .where(
              and(
                eq(schema.organizations.user_id, userId),
                eq(schema.organizations.name, item.organization_name),
              ),
            )
            .limit(1);

          if (existing) {
            orgId = existing.id;
          } else {
            const [created] = await db
              .insert(schema.organizations)
              .values({
                user_id: userId,
                name: item.organization_name,
                slug: slugify(item.organization_name),
              })
              .returning({ id: schema.organizations.id });
            orgId = created!.id;
          }
          orgCache.set(item.organization_name, orgId);
        }

        const [row] = await db
          .insert(schema.communityItems)
          .values({
            user_id: userId,
            organization_id: orgId,
            title: item.title,
            description: item.description ?? null,
            status: item.status,
            due_date: item.due_date ?? null,
          })
          .returning({ id: schema.communityItems.id });

        if (row) imported.push(row.id);
      } catch (err) {
        errors.push({ index: i, error: err instanceof Error ? err.message : 'unknown error' });
      }
    }

    logAudit({
      userId,
      action: 'api_import_community',
      metadata: { count: imported.length, token_id: tokenId },
    });

    return Response.json({ imported: imported.length, ids: imported, errors });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return Response.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error('[api/v1/import/community]', err);
    return Response.json({ error: 'Internal server error', code: 'internal_error' }, { status: 500 });
  }
}
