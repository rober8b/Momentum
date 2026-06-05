'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireRober } from '@/lib/auth';

const communitySchema = z.object({
  organization: z.enum(['ai-consensus', 'levellers', 'xplora', 'other']),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function createCommunityItem(input: z.infer<typeof communitySchema>) {
  await requireRober();
  const parsed = communitySchema.parse(input);
  await db.insert(schema.communityItems).values({ ...parsed, status: 'pending' });
  revalidatePath('/community');
}

export async function toggleCommunityDone(id: string, done: boolean) {
  await requireRober();
  await db
    .update(schema.communityItems)
    .set({ status: done ? 'done' : 'pending' })
    .where(eq(schema.communityItems.id, id));
  revalidatePath('/community');
}

export async function deleteCommunityItem(id: string) {
  await requireRober();
  await db.delete(schema.communityItems).where(eq(schema.communityItems.id, id));
  revalidatePath('/community');
}
