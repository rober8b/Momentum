import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { COOKIE_NAME, verifySession } from '@/lib/auth';
import { isProviderConfigured } from '@/lib/oauth';
import { SignupForm } from './SignupForm';

export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  // Proxy already gates this route — double-check for safety
  if (process.env.ALLOW_SIGNUP !== 'true') {
    notFound();
  }

  // Already logged in → go home
  const store = await cookies();
  const signed = store.get(COOKIE_NAME)?.value;
  if (signed && verifySession(signed)) {
    redirect('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            command
          </p>
          <h1 className="text-2xl font-semibold">center</h1>
          <p className="text-xs text-muted-foreground mt-2">crear cuenta</p>
        </div>
        <SignupForm
          providers={{ github: isProviderConfigured('github'), google: isProviderConfigured('google') }}
        />
      </div>
    </div>
  );
}
