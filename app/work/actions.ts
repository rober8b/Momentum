'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireRober } from '@/lib/auth';
import type { WorkblockStatus } from '@/lib/types';

const STATUSES = ['backlog', 'today', 'in-progress', 'blocked', 'done'] as const;
const statusEnum = z.enum(STATUSES);

const workblockSchema = z.object({
  type: z.enum(['ticket', 'task', 'meeting', 'review']).default('task'),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: statusEnum.default('backlog'),
  priority: z.enum(['low', 'med', 'high']).default('med'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  client: z.string().default('aleph'),
  notes: z.string().optional().nullable(),
  links: z.record(z.string(), z.string()).default({}),
});

export async function createWorkblock(input: z.infer<typeof workblockSchema>) {
  await requireRober();
  const parsed = workblockSchema.parse(input);
  await db.insert(schema.workblocks).values(parsed);
  revalidatePath('/work');
  revalidatePath('/');
}

export async function updateWorkblockStatus(id: string, status: WorkblockStatus) {
  await requireRober();
  const parsed = statusEnum.parse(status);
  const completed_at = parsed === 'done' ? new Date() : null;
  await db
    .update(schema.workblocks)
    .set({ status: parsed, completed_at })
    .where(eq(schema.workblocks.id, id));
  revalidatePath('/work');
  revalidatePath('/');
}

const updateSchema = workblockSchema.partial();

export async function updateWorkblock(
  id: string,
  patch: z.infer<typeof updateSchema>,
) {
  await requireRober();
  const parsed = updateSchema.parse(patch);
  await db.update(schema.workblocks).set(parsed).where(eq(schema.workblocks.id, id));
  revalidatePath('/work');
  revalidatePath(`/work/${id}`);
  revalidatePath('/');
}

export async function deleteWorkblock(id: string) {
  await requireRober();
  await db.delete(schema.workblocks).where(eq(schema.workblocks.id, id));
  revalidatePath('/work');
  revalidatePath('/');
}
