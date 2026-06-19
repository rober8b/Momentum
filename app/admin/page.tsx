import { sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function AdminDashboardPage() {
  await requireAdmin();

  // Single pass over users — all metrics computed in SQL via FILTER aggregates.
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${schema.users.active})::int`,
      inactive: sql<number>`count(*) filter (where not ${schema.users.active})::int`,
      free: sql<number>`count(*) filter (where ${schema.users.plan} = 'free')::int`,
      pro: sql<number>`count(*) filter (where ${schema.users.plan} = 'pro')::int`,
      pastDue: sql<number>`count(*) filter (where ${schema.users.plan_status} = 'past_due')::int`,
      signups7: sql<number>`count(*) filter (where ${schema.users.created_at} >= now() - interval '7 days')::int`,
      signups30: sql<number>`count(*) filter (where ${schema.users.created_at} >= now() - interval '30 days')::int`,
    })
    .from(schema.users);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">usuarios</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard label="total" value={stats.total} />
          <StatCard label="activos" value={stats.active} />
          <StatCard label="inactivos" value={stats.inactive} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">planes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard label="free" value={stats.free} />
          <StatCard label="pro" value={stats.pro} hint="suscripciones pagas" />
          <StatCard label="past due" value={stats.pastDue} hint="pago vencido" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">altas recientes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard label="últimos 7 días" value={stats.signups7} />
          <StatCard label="últimos 30 días" value={stats.signups30} />
        </div>
      </section>
    </div>
  );
}
