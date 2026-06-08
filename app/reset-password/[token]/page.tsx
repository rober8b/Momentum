import { notFound } from 'next/navigation';
import { createHash } from 'node:crypto';
import { and, gt, isNull, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { ResetForm } from './ResetForm';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Verify the token is valid before showing the form
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const [row] = await db
    .select({ id: schema.passwordResetTokens.id })
    .from(schema.passwordResetTokens)
    .where(
      and(
        eq(schema.passwordResetTokens.token_hash, tokenHash),
        isNull(schema.passwordResetTokens.used_at),
        gt(schema.passwordResetTokens.expires_at, new Date()),
      ),
    )
    .limit(1);

  if (!row) notFound();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            command
          </p>
          <h1 className="text-2xl font-semibold">center</h1>
          <p className="text-xs text-muted-foreground mt-2">nueva contraseña</p>
        </div>
        <ResetForm token={token} />
      </div>
    </div>
  );
}
