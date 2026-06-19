import { and, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { AuditFilters } from '@/components/admin/AuditFilters';
import { AuditTable, type AuditEntry } from '@/components/admin/AuditTable';
import { Pagination } from '@/components/admin/Pagination';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; user?: string }>;
}) {
  await requireAdmin();
  const { page: pageParam, action, user } = await searchParams;

  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Build filter predicate. action is a free-text enum value; user is a uuid.
  const conditions = [];
  if (action) conditions.push(eq(schema.auditLog.action, action));
  if (user) conditions.push(eq(schema.auditLog.user_id, user));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ count }], actionRows, userRows] = await Promise.all([
    db
      .select({
        id: schema.auditLog.id,
        action: schema.auditLog.action,
        entity_type: schema.auditLog.entity_type,
        entity_id: schema.auditLog.entity_id,
        metadata: schema.auditLog.metadata,
        created_at: schema.auditLog.created_at,
        user_id: schema.auditLog.user_id,
        user_email: schema.users.email,
      })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.auditLog.user_id, schema.users.id))
      .where(where)
      .orderBy(desc(schema.auditLog.created_at))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.auditLog).where(where),
    // Distinct actions present in the log — bounded by the AuditAction enum (~30).
    db
      .selectDistinct({ action: schema.auditLog.action })
      .from(schema.auditLog)
      .orderBy(schema.auditLog.action),
    // Users for the user filter. Capped — admin tooling, not an unbounded select.
    db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .orderBy(schema.users.email)
      .limit(200),
  ]);

  const entries: AuditEntry[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    metadata: r.metadata,
    created_at: r.created_at.toISOString(),
    user_id: r.user_id,
    user_email: r.user_email,
  }));

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-foreground">auditoría</h2>
        <span className="text-xs text-muted-foreground">{count} eventos</span>
      </div>

      <AuditFilters
        actions={actionRows.map((a) => a.action)}
        users={userRows}
        selectedAction={action ?? ''}
        selectedUser={user ?? ''}
      />

      <AuditTable entries={entries} />

      <Pagination
        basePath="/admin/audit"
        page={page}
        totalPages={totalPages}
        query={{ action, user }}
      />
    </div>
  );
}
