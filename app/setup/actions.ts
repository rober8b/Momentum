'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { hashPassword, signSession, COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { DEFAULT_USER_SETTINGS } from '@/lib/types';

const setupSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1).max(64),
  password: z.string().min(8),
  timezone: z.string().min(1).default('UTC'),
  language: z.enum(['en', 'es']).default('en'),
});

export type SetupState = { error?: string };

export async function setupAction(_prev: SetupState, formData: FormData): Promise<SetupState> {
  // Only allowed if no users exist
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (existing) {
    return { error: 'setup ya completado' };
  }

  const raw = {
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    display_name: String(formData.get('display_name') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
    timezone: String(formData.get('timezone') ?? 'UTC'),
    language: String(formData.get('language') ?? 'en'),
  };

  const parsed = setupSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'datos inválidos' };
  }

  const password_hash = await hashPassword(parsed.data.password);
  const settings = { ...DEFAULT_USER_SETTINGS, timezone: parsed.data.timezone, language: parsed.data.language, export_enabled: true };

  const [user] = await db
    .insert(schema.users)
    .values({
      email: parsed.data.email,
      display_name: parsed.data.display_name,
      password_hash,
      role: 'admin',
      active: true,
      settings,
    })
    .returning({ id: schema.users.id });

  if (!user) return { error: 'error creando usuario' };

  const store = await cookies();
  store.set(COOKIE_NAME, signSession(user.id), {
    ...SESSION_COOKIE_OPTIONS,
    secure: process.env.NODE_ENV === 'production',
  });

  redirect('/');
}
