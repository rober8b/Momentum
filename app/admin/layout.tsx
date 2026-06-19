import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { AdminNav } from '@/components/admin/AdminNav';

// Whole-segment guard: requireAdmin() runs before any /admin/* page renders.
// Non-admins are redirected to '/', unauthenticated users throw NOT_SIGNED_IN
// (and never reach here anyway — proxy.ts redirects them to /login first).
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <Link href="/admin" className="block">
          <h1 className="text-xl font-semibold text-foreground">admin</h1>
        </Link>
        <p className="text-sm text-muted-foreground">
          gestión de la instancia — usuarios, auditoría y métricas.
        </p>
      </div>
      <AdminNav />
      {children}
    </div>
  );
}
