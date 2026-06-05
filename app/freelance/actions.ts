'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireRober } from '@/lib/auth';
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

export async function createClient(input: z.infer<typeof clientSchema>) {
  await requireRober();
  const parsed = clientSchema.parse(input);
  await db.insert(schema.freelanceClients).values(parsed);
  revalidatePath('/freelance');
}

export async function updateClient(id: string, patch: Partial<z.infer<typeof clientSchema>>) {
  await requireRober();
  const parsed = clientSchema.partial().parse(patch);
  await db
    .update(schema.freelanceClients)
    .set({ ...parsed, updated_at: new Date() })
    .where(eq(schema.freelanceClients.id, id));
  revalidatePath('/freelance');
  revalidatePath(`/freelance/${id}`);
}

export async function deleteClient(id: string) {
  await requireRober();
  await db.delete(schema.freelanceClients).where(eq(schema.freelanceClients.id, id));
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

export async function createFreelanceTask(input: z.infer<typeof taskSchema>) {
  await requireRober();
  const parsed = taskSchema.parse(input);
  await db.insert(schema.freelanceTasks).values(parsed);
  revalidatePath('/freelance');
  if (parsed.client_id) revalidatePath(`/freelance/${parsed.client_id}`);
}

export async function updateFreelanceTaskStatus(id: string, status: FreelanceTaskStatus) {
  await requireRober();
  const parsed = taskStatusEnum.parse(status);
  const completed_at = parsed === 'done' ? new Date() : null;
  await db
    .update(schema.freelanceTasks)
    .set({ status: parsed, completed_at })
    .where(eq(schema.freelanceTasks.id, id));
  revalidatePath('/freelance');
}

export async function deleteFreelanceTask(id: string) {
  await requireRober();
  await db.delete(schema.freelanceTasks).where(eq(schema.freelanceTasks.id, id));
  revalidatePath('/freelance');
}
