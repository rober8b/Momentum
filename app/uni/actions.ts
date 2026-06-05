'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireRober } from '@/lib/auth';

const dayEnum = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const slotSchema = z.object({
  day: dayEnum,
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().optional(),
});

const subjectSchema = z.object({
  name: z.string().min(1),
  semester: z.string().min(1).default('2026-1'),
  schedule: z.array(slotSchema).default([]),
  vault_slug: z.string().optional().nullable(),
});

export async function createSubject(input: z.infer<typeof subjectSchema>) {
  await requireRober();
  const parsed = subjectSchema.parse(input);
  await db.insert(schema.subjects).values(parsed);
  revalidatePath('/uni');
  revalidatePath('/');
}

export async function updateSubjectSchedule(
  id: string,
  scheduleInput: z.infer<typeof slotSchema>[],
) {
  await requireRober();
  const parsed = z.array(slotSchema).parse(scheduleInput);
  await db
    .update(schema.subjects)
    .set({ schedule: parsed })
    .where(eq(schema.subjects.id, id));
  revalidatePath('/uni');
  revalidatePath('/');
}

const assignmentSchema = z.object({
  subject_id: z.string().uuid().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function createAssignment(input: z.infer<typeof assignmentSchema>) {
  await requireRober();
  const parsed = assignmentSchema.parse(input);
  await db.insert(schema.assignments).values({ ...parsed, status: 'todo' });
  revalidatePath('/uni');
  revalidatePath('/');
}

export async function toggleAssignmentDone(id: string, done: boolean) {
  await requireRober();
  await db
    .update(schema.assignments)
    .set({
      status: done ? 'done' : 'todo',
      completed_at: done ? new Date() : null,
    })
    .where(eq(schema.assignments.id, id));
  revalidatePath('/uni');
  revalidatePath('/');
}

export async function deleteAssignment(id: string) {
  await requireRober();
  await db.delete(schema.assignments).where(eq(schema.assignments.id, id));
  revalidatePath('/uni');
  revalidatePath('/');
}
