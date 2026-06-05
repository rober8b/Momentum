'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireRober } from '@/lib/auth';
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

export async function quickCaptureIdea(title: string) {
  await requireRober();
  await db.insert(schema.buildItems).values({
    title: title.slice(0, 200),
    type: 'project',
    status: 'idea',
    platforms: ['x', 'linkedin'],
  });
  revalidatePath('/build');
  revalidatePath('/');
}

export async function createBuildItem(input: z.infer<typeof buildSchema>) {
  await requireRober();
  const parsed = buildSchema.parse(input);
  await db.insert(schema.buildItems).values({
    ...parsed,
    scheduled_for: toDate(parsed.scheduled_for),
    published_at: toDate(parsed.published_at),
  });
  revalidatePath('/build');
  revalidatePath('/');
}

const updateSchema = buildSchema.partial();

export async function updateBuildItem(
  id: string,
  patch: z.infer<typeof updateSchema>,
) {
  await requireRober();
  const parsed = updateSchema.parse(patch);
  const dbPatch: Record<string, unknown> = { ...parsed };
  if ('scheduled_for' in parsed) dbPatch.scheduled_for = toDate(parsed.scheduled_for ?? null);
  if ('published_at' in parsed) dbPatch.published_at = toDate(parsed.published_at ?? null);
  await db.update(schema.buildItems).set(dbPatch).where(eq(schema.buildItems.id, id));
  revalidatePath('/build');
  revalidatePath('/');
}

export async function updateBuildStatus(id: string, status: BuildStatus) {
  await requireRober();
  const patch: { status: BuildStatus; published_at?: Date } = { status };
  if (status === 'published') {
    patch.published_at = new Date();
  }
  await db.update(schema.buildItems).set(patch).where(eq(schema.buildItems.id, id));
  revalidatePath('/build');
  revalidatePath('/');
}

export async function markPublished(
  id: string,
  links: Record<string, string>,
) {
  await requireRober();
  await db
    .update(schema.buildItems)
    .set({
      status: 'published',
      published_at: new Date(),
      links,
    })
    .where(eq(schema.buildItems.id, id));
  revalidatePath('/build');
  revalidatePath('/');
}

export async function deleteBuildItem(id: string) {
  await requireRober();
  await db.delete(schema.buildItems).where(eq(schema.buildItems.id, id));
  revalidatePath('/build');
  revalidatePath('/');
}
