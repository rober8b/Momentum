'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireRober } from '@/lib/auth';

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(['active', 'paused', 'blocked', 'archived']).default('active'),
  last_update: z.string().optional().nullable(),
  next_step: z.string().optional().nullable(),
  links: z.record(z.string(), z.string()).default({}),
});

export async function createProject(input: z.infer<typeof projectSchema>) {
  await requireRober();
  const parsed = projectSchema.parse(input);
  await db.insert(schema.ownProjects).values(parsed);
  revalidatePath('/projects');
}

export async function updateProject(id: string, patch: Partial<z.infer<typeof projectSchema>>) {
  await requireRober();
  const parsed = projectSchema.partial().parse(patch);
  await db
    .update(schema.ownProjects)
    .set({ ...parsed, updated_at: new Date() })
    .where(eq(schema.ownProjects.id, id));
  revalidatePath('/projects');
}

export async function deleteProject(id: string) {
  await requireRober();
  await db.delete(schema.ownProjects).where(eq(schema.ownProjects.id, id));
  revalidatePath('/projects');
}
