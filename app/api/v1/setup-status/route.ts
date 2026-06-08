import { db, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [row] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  const hasAdmin = !!row;
  const signupEnabled = process.env.ALLOW_SIGNUP === 'true';

  return Response.json({
    has_admin: hasAdmin,
    signup_enabled: signupEnabled,
    setup_required: !hasAdmin,
  });
}
