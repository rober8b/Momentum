'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { hashPassword, signSession, COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { DEFAULT_USER_SETTINGS } from '@/lib/types';

const signupSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1).max(64),
  password: z.string().min(8),
  timezone: z.string().min(1).default('UTC'),
});

export type SignupState = { error?: string };

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  if (process.env.ALLOW_SIGNUP !== 'true') {
    return { error: 'registro no habilitado' };
  }

  const raw = {
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    display_name: String(formData.get('display_name') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
    timezone: String(formData.get('timezone') ?? 'UTC'),
  };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'datos inválidos' };
  }

  // Check email not already in use
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.email))
    .limit(1);

  if (existing) {
    return { error: 'ese email ya está registrado' };
  }

  const password_hash = await hashPassword(parsed.data.password);
  const settings = { ...DEFAULT_USER_SETTINGS, timezone: parsed.data.timezone };

  const [user] = await db
    .insert(schema.users)
    .values({
      email: parsed.data.email,
      display_name: parsed.data.display_name,
      password_hash,
      role: 'member',
      active: true,
      settings,
    })
    .returning({ id: schema.users.id });

  if (!user) return { error: 'error creando cuenta' };

  logAudit({ userId: user.id, action: 'signup' });

  const store = await cookies();
  store.set(COOKIE_NAME, signSession(user.id), {
    ...SESSION_COOKIE_OPTIONS,
    secure: process.env.NODE_ENV === 'production',
  });

  redirect('/');
}
