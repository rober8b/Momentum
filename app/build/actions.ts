'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { checkLimit, type LimitReachedError } from '@/lib/limits';
import type { BuildStatus } from '@/lib/types';

const buildSchema = z.object({
  type: z
    .enum(['hackathon', 'project', 'opinion', 'news', 'portfolio-update', 'open-source', 'demo'])
    .default('project'),
  title: z.string().min(1),
  draft: z.string().optional().nullable(),
  hook: z.string().optional().nullable(),
  platforms: z.array(z.string()).default(['x', 'linkedin']),
  status: z
    .enum(['idea', 'draft', 'scheduled', 'published', 'discarded'])
    .default('idea'),
  scheduled_for: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  links: z.record(z.string(), z.string()).default({}),
  metrics: z.record(z.string(), z.number()).default({}),
  related_project: z.string().optional().nullable(),
});

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  return new Date(v);
}

export async function quickCaptureIdea(title: string): Promise<LimitReachedError | void> {
  const user = await requireUser();
  const limitCheck = await checkLimit(user.id, 'build_items');
  if (!limitCheck.allowed) {
    return { error: 'limit_reached', resource: 'build_items', limit: limitCheck.limit! };
  }
  const [row] = await db.insert(schema.buildItems).values({
    user_id: user.id,
    title: title.slice(0, 200),
    type: 'project',
    status: 'idea',
    platforms: ['x', 'linkedin'],
  }).returning({ id: schema.buildItems.id });
  logAudit({ userId: user.id, action: 'create', entityType: 'build_item', entityId: row?.id });
  revalidatePath('/build');
  revalidatePath('/');
}

export async function createBuildItem(input: z.infer<typeof buildSchema>): Promise<LimitReachedError | void> {
  const user = await requireUser();
  const limitCheck = await checkLimit(user.id, 'build_items');
  if (!limitCheck.allowed) {
    return { error: 'limit_reached', resource: 'build_items', limit: limitCheck.limit! };
  }
  const parsed = buildSchema.parse(input);
  const [row] = await db.insert(schema.buildItems).values({
    ...parsed,
    user_id: user.id,
    scheduled_for: toDate(parsed.scheduled_for),
    published_at: toDate(parsed.published_at),
  }).returning({ id: schema.buildItems.id });
  logAudit({ userId: user.id, action: 'create', entityType: 'build_item', entityId: row?.id });
  revalidatePath('/build');
  revalidatePath('/');
}

const updateSchema = buildSchema.partial();

export async function updateBuildItem(
  id: string,
  patch: z.infer<typeof updateSchema>,
) {
  const user = await requireUser();
  const parsed = updateSchema.parse(patch);
  const dbPatch: Record<string, unknown> = { ...parsed };
  if ('scheduled_for' in parsed) dbPatch.scheduled_for = toDate(parsed.scheduled_for ?? null);
  if ('published_at' in parsed) dbPatch.published_at = toDate(parsed.published_at ?? null);
  await db.update(schema.buildItems).set(dbPatch).where(and(eq(schema.buildItems.id, id), eq(schema.buildItems.user_id, user.id)));
  revalidatePath('/build');
  revalidatePath('/');
}

export async function updateBuildStatus(id: string, status: BuildStatus) {
  const user = await requireUser();
  const patch: { status: BuildStatus; published_at?: Date } = { status };
  if (status === 'published') {
    patch.published_at = new Date();
  }
  await db.update(schema.buildItems).set(patch).where(and(eq(schema.buildItems.id, id), eq(schema.buildItems.user_id, user.id)));
  revalidatePath('/build');
  revalidatePath('/');
}

export async function markPublished(
  id: string,
  links: Record<string, string>,
) {
  const user = await requireUser();
  await db
    .update(schema.buildItems)
    .set({
      status: 'published',
      published_at: new Date(),
      links,
    })
    .where(and(eq(schema.buildItems.id, id), eq(schema.buildItems.user_id, user.id)));
  revalidatePath('/build');
  revalidatePath('/');
}

export async function deleteBuildItem(id: string) {
  const user = await requireUser();
  await db.delete(schema.buildItems).where(and(eq(schema.buildItems.id, id), eq(schema.buildItems.user_id, user.id)));
  logAudit({ userId: user.id, action: 'delete', entityType: 'build_item', entityId: id });
  revalidatePath('/build');
  revalidatePath('/');
}
