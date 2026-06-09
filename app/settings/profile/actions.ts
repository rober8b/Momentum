'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const profileSchema = z.object({
  display_name: z.string().min(1).max(100),
  settings: z.object({
    timezone: z.string().min(1),
    language: z.enum(['en', 'es']),
    vault_path: z.string(),
    export_enabled: z.boolean(),
  }),
});

export async function updateUserProfile(input: unknown) {
  const user = await requireUser();
  const parsed = profileSchema.parse(input);

  await db
    .update(schema.users)
    .set({
      display_name: parsed.display_name,
      settings: {
        ...user.settings,
        timezone: parsed.settings.timezone,
        language: parsed.settings.language,
        vault_path: parsed.settings.vault_path,
        export_enabled: parsed.settings.export_enabled,
      },
    })
    .where(eq(schema.users.id, user.id));

  logAudit({ userId: user.id, action: 'settings_updated' });
  revalidatePath('/settings/profile');
}
