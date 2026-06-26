'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { checkLimit, type LimitReachedError } from '@/lib/limits';
import type { FreelanceTaskStatus } from '@/lib/types';

const clientSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(['active', 'paused', 'blocked', 'archived']).default('active'),
  stack: z.string().optional().nullable(),
  next_step: z.string().optional().nullable(),
  last_update: z.string().optional().nullable(),
  links: z.record(z.string(), z.string()).default({}),
});

export async function createClient(input: z.infer<typeof clientSchema>): Promise<LimitReachedError | void> {
  const user = await requireUser();
  const parsed = clientSchema.parse(input);
  const [row] = await db.insert(schema.freelanceClients).values({ ...parsed, user_id: user.id }).returning({ id: schema.freelanceClients.id });
  logAudit({ userId: user.id, action: 'create', entityType: 'freelance_client', entityId: row?.id });
  revalidatePath('/freelance');
}

export async function updateClient(id: string, patch: Partial<z.infer<typeof clientSchema>>) {
  const user = await requireUser();
  const parsed = clientSchema.partial().parse(patch);
  await db
    .update(schema.freelanceClients)
    .set({ ...parsed, updated_at: new Date() })
    .where(and(eq(schema.freelanceClients.id, id), eq(schema.freelanceClients.user_id, user.id)));
  revalidatePath('/freelance');
  revalidatePath(`/freelance/${id}`);
}

export async function deleteClient(id: string) {
  const user = await requireUser();
  await db.delete(schema.freelanceClients).where(and(eq(schema.freelanceClients.id, id), eq(schema.freelanceClients.user_id, user.id)));
  logAudit({ userId: user.id, action: 'delete', entityType: 'freelance_client', entityId: id });
  revalidatePath('/freelance');
}

const taskStatusEnum = z.enum(['backlog', 'today', 'in-progress', 'blocked', 'done']);

const taskSchema = z.object({
  client_id: z.string().uuid().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: taskStatusEnum.default('backlog'),
  priority: z.enum(['low', 'med', 'high']).default('med'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function createFreelanceTask(input: z.infer<typeof taskSchema>): Promise<LimitReachedError | void> {
  const user = await requireUser();
  const limitCheck = await checkLimit(user.id, 'leaf_items');
  if (!limitCheck.allowed) {
    return { error: 'limit_reached', resource: 'leaf_items', limit: limitCheck.limit! };
  }
  const parsed = taskSchema.parse(input);
  const [row] = await db.insert(schema.freelanceTasks).values({ ...parsed, user_id: user.id }).returning({ id: schema.freelanceTasks.id });
  logAudit({ userId: user.id, action: 'create', entityType: 'freelance_task', entityId: row?.id });
  revalidatePath('/freelance');
  if (parsed.client_id) revalidatePath(`/freelance/${parsed.client_id}`);
}

export async function updateFreelanceTaskStatus(id: string, status: FreelanceTaskStatus) {
  const user = await requireUser();
  const parsed = taskStatusEnum.parse(status);
  const completed_at = parsed === 'done' ? new Date() : null;
  await db
    .update(schema.freelanceTasks)
    .set({ status: parsed, completed_at })
    .where(and(eq(schema.freelanceTasks.id, id), eq(schema.freelanceTasks.user_id, user.id)));
  revalidatePath('/freelance');
}

export async function deleteFreelanceTask(id: string) {
  const user = await requireUser();
  await db.delete(schema.freelanceTasks).where(and(eq(schema.freelanceTasks.id, id), eq(schema.freelanceTasks.user_id, user.id)));
  logAudit({ userId: user.id, action: 'delete', entityType: 'freelance_task', entityId: id });
  revalidatePath('/freelance');
}
