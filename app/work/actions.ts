'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
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
  client: z.string().default(''),
  notes: z.string().optional().nullable(),
  links: z.record(z.string(), z.string()).default({}),
});

export async function createWorkblock(input: z.infer<typeof workblockSchema>) {
  const user = await requireUser();
  const parsed = workblockSchema.parse(input);
  const [row] = await db.insert(schema.workblocks).values({ ...parsed, user_id: user.id }).returning({ id: schema.workblocks.id });
  logAudit({ userId: user.id, action: 'create', entityType: 'workblock', entityId: row?.id });
  revalidatePath('/work');
  revalidatePath('/');
}

export async function updateWorkblockStatus(id: string, status: WorkblockStatus) {
  const user = await requireUser();
  const parsed = statusEnum.parse(status);
  const completed_at = parsed === 'done' ? new Date() : null;
  await db
    .update(schema.workblocks)
    .set({ status: parsed, completed_at })
    .where(and(eq(schema.workblocks.id, id), eq(schema.workblocks.user_id, user.id)));
  revalidatePath('/work');
  revalidatePath('/');
}

const updateSchema = workblockSchema.partial();

export async function updateWorkblock(
  id: string,
  patch: z.infer<typeof updateSchema>,
) {
  const user = await requireUser();
  const parsed = updateSchema.parse(patch);
  await db.update(schema.workblocks).set(parsed).where(and(eq(schema.workblocks.id, id), eq(schema.workblocks.user_id, user.id)));
  revalidatePath('/work');
  revalidatePath(`/work/${id}`);
  revalidatePath('/');
}

export async function deleteWorkblock(id: string) {
  const user = await requireUser();
  await db.delete(schema.workblocks).where(and(eq(schema.workblocks.id, id), eq(schema.workblocks.user_id, user.id)));
  logAudit({ userId: user.id, action: 'delete', entityType: 'workblock', entityId: id });
  revalidatePath('/work');
  revalidatePath('/');
}
