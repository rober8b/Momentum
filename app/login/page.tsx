import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { isProviderConfigured } from '@/lib/oauth';
import { oauthErrorMessage } from '@/lib/strings';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next, error } = await searchParams;

  // Redirect to setup if no users exist yet
  const [firstUser] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (!firstUser) {
    redirect('/setup');
  }

  // Already logged in — go to destination
  const user = await getCurrentUser();
  if (user) {
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
        <LoginForm
          next={next ?? '/'}
          providers={{ github: isProviderConfigured('github'), google: isProviderConfigured('google') }}
          oauthError={oauthErrorMessage(error, 'es')}
        />
      </div>
    </div>
  );
}
