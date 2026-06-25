'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { checkLimit, type LimitReachedError } from '@/lib/limits';
import { isBuildDynamicEngineEnabled } from '@/lib/pillar-flags';
import { BUILD_TEMPLATE } from '@/lib/pillar-templates';
import { ensurePillarForUser, insertPillarItem } from '@/lib/pillar-writes';
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

  let itemId: string | undefined;
  if (isBuildDynamicEngineEnabled()) {
    const pillarId = await ensurePillarForUser(user.id, BUILD_TEMPLATE);
    itemId = await insertPillarItem({
      userId: user.id,
      pillarId,
      isContainer: false,
      title: title.slice(0, 200),
      status: 'idea',
      fields: { type: 'project', platforms: ['x', 'linkedin'] },
    });
  } else {
    const [row] = await db.insert(schema.buildItems).values({
      user_id: user.id,
      title: title.slice(0, 200),
      type: 'project',
      status: 'idea',
      platforms: ['x', 'linkedin'],
    }).returning({ id: schema.buildItems.id });
    itemId = row?.id;
  }
  logAudit({ userId: user.id, action: 'create', entityType: 'build_item', entityId: itemId });
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

  let itemId: string | undefined;
  if (isBuildDynamicEngineEnabled()) {
    const pillarId = await ensurePillarForUser(user.id, BUILD_TEMPLATE);
    itemId = await insertPillarItem({
      userId: user.id,
      pillarId,
      isContainer: false,
      title: parsed.title,
      status: parsed.status,
      completedAt: toDate(parsed.published_at),
      fields: {
        type: parsed.type,
        draft: parsed.draft ?? null,
        hook: parsed.hook ?? null,
        platforms: parsed.platforms,
        links: parsed.links,
        metrics: parsed.metrics,
        related_project: parsed.related_project ?? null,
        scheduled_for: toDate(parsed.scheduled_for)?.toISOString() ?? null,
      },
    });
  } else {
    const [row] = await db.insert(schema.buildItems).values({
      ...parsed,
      user_id: user.id,
      scheduled_for: toDate(parsed.scheduled_for),
      published_at: toDate(parsed.published_at),
    }).returning({ id: schema.buildItems.id });
    itemId = row?.id;
  }
  logAudit({ userId: user.id, action: 'create', entityType: 'build_item', entityId: itemId });
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

  if (isBuildDynamicEngineEnabled()) {
    const fieldsKeys = ['type', 'draft', 'hook', 'platforms', 'links', 'metrics', 'related_project', 'scheduled_for'] as const;
    const typedPatch: Record<string, unknown> = { updated_at: new Date() };
    if ('title' in parsed) typedPatch.title = parsed.title;
    if ('status' in parsed) typedPatch.status = parsed.status;
    if ('published_at' in parsed) typedPatch.completed_at = toDate(parsed.published_at ?? null);

    if (fieldsKeys.some((k) => k in parsed)) {
      const [existing] = await db
        .select({ fields: schema.pillarItems.fields })
        .from(schema.pillarItems)
        .where(and(eq(schema.pillarItems.id, id), eq(schema.pillarItems.user_id, user.id)))
        .limit(1);
      const mergedFields = { ...(existing?.fields ?? {}) };
      if ('type' in parsed) mergedFields.type = parsed.type;
      if ('draft' in parsed) mergedFields.draft = parsed.draft ?? null;
      if ('hook' in parsed) mergedFields.hook = parsed.hook ?? null;
      if ('platforms' in parsed) mergedFields.platforms = parsed.platforms;
      if ('links' in parsed) mergedFields.links = parsed.links;
      if ('metrics' in parsed) mergedFields.metrics = parsed.metrics;
      if ('related_project' in parsed) mergedFields.related_project = parsed.related_project ?? null;
      if ('scheduled_for' in parsed) mergedFields.scheduled_for = toDate(parsed.scheduled_for ?? null)?.toISOString() ?? null;
      typedPatch.fields = mergedFields;
    }

    await db.update(schema.pillarItems).set(typedPatch).where(and(eq(schema.pillarItems.id, id), eq(schema.pillarItems.user_id, user.id)));
  } else {
    const dbPatch: Record<string, unknown> = { ...parsed };
    if ('scheduled_for' in parsed) dbPatch.scheduled_for = toDate(parsed.scheduled_for ?? null);
    if ('published_at' in parsed) dbPatch.published_at = toDate(parsed.published_at ?? null);
    await db.update(schema.buildItems).set(dbPatch).where(and(eq(schema.buildItems.id, id), eq(schema.buildItems.user_id, user.id)));
  }
  revalidatePath('/build');
  revalidatePath('/');
}

export async function updateBuildStatus(id: string, status: BuildStatus) {
  const user = await requireUser();

  if (isBuildDynamicEngineEnabled()) {
    const patch: { status: BuildStatus; completed_at?: Date; updated_at: Date } = { status, updated_at: new Date() };
    if (status === 'published') patch.completed_at = new Date();
    await db.update(schema.pillarItems).set(patch).where(and(eq(schema.pillarItems.id, id), eq(schema.pillarItems.user_id, user.id)));
  } else {
    const patch: { status: BuildStatus; published_at?: Date } = { status };
    if (status === 'published') patch.published_at = new Date();
    await db.update(schema.buildItems).set(patch).where(and(eq(schema.buildItems.id, id), eq(schema.buildItems.user_id, user.id)));
  }
  revalidatePath('/build');
  revalidatePath('/');
}

export async function markPublished(
  id: string,
  links: Record<string, string>,
) {
  const user = await requireUser();

  if (isBuildDynamicEngineEnabled()) {
    const [existing] = await db
      .select({ fields: schema.pillarItems.fields })
      .from(schema.pillarItems)
      .where(and(eq(schema.pillarItems.id, id), eq(schema.pillarItems.user_id, user.id)))
      .limit(1);
    await db
      .update(schema.pillarItems)
      .set({
        status: 'published',
        completed_at: new Date(),
        fields: { ...(existing?.fields ?? {}), links },
        updated_at: new Date(),
      })
      .where(and(eq(schema.pillarItems.id, id), eq(schema.pillarItems.user_id, user.id)));
  } else {
    await db
      .update(schema.buildItems)
      .set({
        status: 'published',
        published_at: new Date(),
        links,
      })
      .where(and(eq(schema.buildItems.id, id), eq(schema.buildItems.user_id, user.id)));
  }
  revalidatePath('/build');
  revalidatePath('/');
}

export async function deleteBuildItem(id: string) {
  const user = await requireUser();
  if (isBuildDynamicEngineEnabled()) {
    await db.delete(schema.pillarItems).where(and(eq(schema.pillarItems.id, id), eq(schema.pillarItems.user_id, user.id)));
  } else {
    await db.delete(schema.buildItems).where(and(eq(schema.buildItems.id, id), eq(schema.buildItems.user_id, user.id)));
  }
  logAudit({ userId: user.id, action: 'delete', entityType: 'build_item', entityId: id });
  revalidatePath('/build');
  revalidatePath('/');
}
