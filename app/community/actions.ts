'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const communitySchema = z.object({
  organization_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const orgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
});

export async function createOrganization(input: z.infer<typeof orgSchema>) {
  const user = await requireUser();
  const parsed = orgSchema.parse(input);
  const [row] = await db
    .insert(schema.organizations)
    .values({ ...parsed, user_id: user.id })
    .returning({ id: schema.organizations.id });
  logAudit({ userId: user.id, action: 'create', entityType: 'organization', entityId: row?.id });
  revalidatePath('/community');
  return row;
}

export async function createCommunityItem(input: z.infer<typeof communitySchema>) {
  const user = await requireUser();
  const parsed = communitySchema.parse(input);
  const [row] = await db
    .insert(schema.communityItems)
    .values({ ...parsed, user_id: user.id, status: 'pending' })
    .returning({ id: schema.communityItems.id });
  logAudit({ userId: user.id, action: 'create', entityType: 'community_item', entityId: row?.id });
  revalidatePath('/community');
}

export async function toggleCommunityDone(id: string, done: boolean) {
  const user = await requireUser();
  await db
    .update(schema.communityItems)
    .set({ status: done ? 'done' : 'pending' })
    .where(and(eq(schema.communityItems.id, id), eq(schema.communityItems.user_id, user.id)));
  revalidatePath('/community');
}

export async function deleteCommunityItem(id: string) {
  const user = await requireUser();
  await db.delete(schema.communityItems).where(and(eq(schema.communityItems.id, id), eq(schema.communityItems.user_id, user.id)));
  logAudit({ userId: user.id, action: 'delete', entityType: 'community_item', entityId: id });
  revalidatePath('/community');
}

export async function cancelCommunityItem(id: string) {
  const user = await requireUser();
  await db
    .update(schema.communityItems)
    .set({ status: 'cancelled' })
    .where(and(eq(schema.communityItems.id, id), eq(schema.communityItems.user_id, user.id)));
  revalidatePath('/community');
}
