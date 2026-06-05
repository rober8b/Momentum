import { redirect } from 'next/navigation';
import { isAuthed } from '@/lib/auth';
import { LoginForm } from './LoginForm';

type SearchParams = Promise<{ next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next } = await searchParams;

  if (await isAuthed()) {
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
          <p className="text-xs text-muted-foreground mt-2 font-mono">single-user · rober</p>
        </div>
        <LoginForm next={next ?? '/'} />
      </div>
    </div>
  );
}
