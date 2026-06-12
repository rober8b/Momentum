'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';

/** Marks the welcome onboarding as seen so it doesn't show again. */
export async function completeOnboarding() {
  const user = await requireUser();

  await db
    .update(schema.users)
    .set({ settings: { ...user.settings, onboarding_completed: true } })
    .where(eq(schema.users.id, user.id));

  revalidatePath('/');
}
