import { desc, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { UsersTable, type AdminUserRow } from '@/components/admin/UsersTable';
import { Pagination } from '@/components/admin/Pagination';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const admin = await requireAdmin();
  const { page: pageParam } = await searchParams;

  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        display_name: schema.users.display_name,
        role: schema.users.role,
        plan: schema.users.plan,
        plan_status: schema.users.plan_status,
        active: schema.users.active,
        created_at: schema.users.created_at,
        last_login_at: schema.users.last_login_at,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.created_at))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.users),
  ]);

  const users: AdminUserRow[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    display_name: r.display_name,
    role: r.role,
    plan: r.plan,
    plan_status: r.plan_status,
    active: r.active,
    created_at: r.created_at.toISOString(),
    last_login_at: r.last_login_at ? r.last_login_at.toISOString() : null,
  }));

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-foreground">usuarios</h2>
        <span className="text-xs text-muted-foreground">{count} en total</span>
      </div>
      <UsersTable users={users} currentUserId={admin.id} />
      <Pagination basePath="/admin/users" page={page} totalPages={totalPages} />
    </div>
  );
}
