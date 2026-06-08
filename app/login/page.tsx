import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { db, schema } from '@/lib/db';
import { COOKIE_NAME } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next } = await searchParams;

  // Redirect to setup if no users exist yet
  const [firstUser] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (!firstUser) {
    redirect('/setup');
  }

  // Already logged in — go to destination
  const store = await cookies();
  const signed = store.get(COOKIE_NAME)?.value;
  if (signed && verifySession(signed)) {
    redirect(next && next.startsWith('/') ? next : '/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            command
          </p>
          <h1 className="text-2xl font-semibold">center</h1>
        </div>
        <LoginForm next={next ?? '/'} />
      </div>
    </div>
  );
}
