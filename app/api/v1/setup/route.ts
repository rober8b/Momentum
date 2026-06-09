import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { DEFAULT_USER_SETTINGS } from '@/lib/types';

export const dynamic = 'force-dynamic';

const SetupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1).max(100),
  language: z.enum(['en', 'es']).default('en'),
  timezone: z.string().default('UTC'),
});

export async function POST(request: Request) {
  try {
    // Block if any user already exists
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
    if (existing) {
      return Response.json(
        { error: 'Setup has already been completed', code: 'setup_already_completed' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = SetupSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { email, password, name, language, timezone } = parsed.data;
    const password_hash = await hashPassword(password);
    const settings = { ...DEFAULT_USER_SETTINGS, language, timezone, export_enabled: true };

    const [user] = await db
      .insert(schema.users)
      .values({
        email: email.toLowerCase().trim(),
        display_name: name,
        password_hash,
        role: 'admin',
        active: true,
        settings,
      })
      .returning({ id: schema.users.id, email: schema.users.email, display_name: schema.users.display_name });

    if (!user) {
      return Response.json({ error: 'Failed to create admin user', code: 'internal_error' }, { status: 500 });
    }

    logAudit({ userId: user.id, action: 'setup_completed' });

    return Response.json(
      {
        success: true,
        admin: {
          id: user.id,
          email: user.email,
          name: user.display_name,
        },
        next_step: 'Generate an API token at /settings/api-tokens',
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/v1/setup]', err);
    return Response.json({ error: 'Internal server error', code: 'internal_error' }, { status: 500 });
  }
}
