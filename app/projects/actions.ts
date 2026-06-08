'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(['active', 'paused', 'blocked', 'archived']).default('active'),
  last_update: z.string().optional().nullable(),
  next_step: z.string().optional().nullable(),
  links: z.record(z.string(), z.string()).default({}),
});

export async function createProject(input: z.infer<typeof projectSchema>) {
  const user = await requireUser();
  const parsed = projectSchema.parse(input);
  const [row] = await db.insert(schema.ownProjects).values({ ...parsed, user_id: user.id }).returning({ id: schema.ownProjects.id });
  logAudit({ userId: user.id, action: 'create', entityType: 'own_project', entityId: row?.id });
  revalidatePath('/projects');
}

export async function updateProject(id: string, patch: Partial<z.infer<typeof projectSchema>>) {
  const user = await requireUser();
  const parsed = projectSchema.partial().parse(patch);
  await db
    .update(schema.ownProjects)
    .set({ ...parsed, updated_at: new Date() })
    .where(and(eq(schema.ownProjects.id, id), eq(schema.ownProjects.user_id, user.id)));
  revalidatePath('/projects');
}

export async function deleteProject(id: string) {
  const user = await requireUser();
  await db.delete(schema.ownProjects).where(and(eq(schema.ownProjects.id, id), eq(schema.ownProjects.user_id, user.id)));
  logAudit({ userId: user.id, action: 'delete', entityType: 'own_project', entityId: id });
  revalidatePath('/projects');
}
