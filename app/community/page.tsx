import { and, asc, eq, ne } from 'drizzle-orm';
import { CommitmentRow } from '@/components/community/CommitmentRow';
import { CommunityForm } from '@/components/community/CommunityForm';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rowToCommunityItem, rowToOrganization } from '@/lib/today';

export const dynamic = 'force-dynamic';

export default async function CommunityPage() {
  const user = await requireUser();

  const [activeRows, cancelledRows, orgRows] = await Promise.all([
    db
      .select({
        item: schema.communityItems,
        org_name: schema.organizations.name,
      })
      .from(schema.communityItems)
      .leftJoin(schema.organizations, eq(schema.communityItems.organization_id, schema.organizations.id))
      .where(and(ne(schema.communityItems.status, 'cancelled'), eq(schema.communityItems.user_id, user.id)))
      .orderBy(asc(schema.communityItems.due_date)),
    db
      .select({
        item: schema.communityItems,
        org_name: schema.organizations.name,
      })
      .from(schema.communityItems)
      .leftJoin(schema.organizations, eq(schema.communityItems.organization_id, schema.organizations.id))
      .where(and(eq(schema.communityItems.status, 'cancelled'), eq(schema.communityItems.user_id, user.id)))
      .orderBy(asc(schema.communityItems.created_at)),
    db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.user_id, user.id))
      .orderBy(asc(schema.organizations.name)),
  ]);

  const orgs = orgRows.map(rowToOrganization);
  const items = activeRows.map((r) => rowToCommunityItem(r.item, r.org_name ?? null));
  const cancelled = cancelledRows.map((r) => rowToCommunityItem(r.item, r.org_name ?? null));
  const pending = items.filter((i) => i.status === 'pending');
  const done = items.filter((i) => i.status === 'done');

  // Group pending items by organization
  const byOrg = new Map<string, typeof pending>();
  const noOrg: typeof pending = [];
  for (const item of pending) {
    if (!item.organization_id) {
      noOrg.push(item);
    } else {
      const key = item.organization_id;
      const arr = byOrg.get(key) ?? [];
      arr.push(item);
      byOrg.set(key, arr);
    }
  }

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-3xl">
      <div className="mb-6 lg:mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            comunidad
          </p>
          <h2 className="text-2xl lg:text-3xl font-semibold mt-1">compromisos</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {pending.length} pendientes
          </p>
        </div>
        <CommunityForm orgs={orgs} />
      </div>

      {pending.length === 0 && (
        <p className="text-xs text-muted-foreground py-10 text-center">
          no hay compromisos pendientes. agregá uno con el botón de arriba.
        </p>
      )}

      {orgs.filter((o) => byOrg.has(o.id)).map((org) => {
        const orgItems = byOrg.get(org.id) ?? [];
        return (
          <Card key={org.id} className="mb-4">
            <CardHeader>
              <CardTitle>{org.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {orgItems.map((item) => (
                  <CommitmentRow key={item.id} item={item} tz={user.settings.timezone} lang={user.settings.language} />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {noOrg.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>sin organización</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {noOrg.map((item) => (
                <CommitmentRow key={item.id} item={item} tz={user.settings.timezone} lang={user.settings.language} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {done.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>completados ({done.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {done.slice(0, 10).map((item) => (
                <CommitmentRow key={item.id} item={item} tz={user.settings.timezone} lang={user.settings.language} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {cancelled.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
            cancelados ({cancelled.length})
          </summary>
          <div className="mt-3 space-y-2">
            {cancelled.map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-surface-elev p-2.5 opacity-50">
                <p className="text-sm line-through">{item.title}</p>
                <span className="text-xs text-muted-foreground">{item.organization_name ?? '—'}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
