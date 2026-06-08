import { redirect } from 'next/navigation';
import { db, schema } from '@/lib/db';
import { SetupForm } from './SetupForm';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  // If users already exist, setup is complete — go to login
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (existing) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            command
          </p>
          <h1 className="text-2xl font-semibold">center</h1>
          <p className="text-xs text-muted-foreground mt-2">configuración inicial</p>
        </div>
        <SetupForm />
      </div>
    </div>
  );
}
