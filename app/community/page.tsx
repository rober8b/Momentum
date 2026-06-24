import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { Users, Layers } from 'lucide-react';
import { CommitmentRow } from '@/components/community/CommitmentRow';
import { CommunityForm } from '@/components/community/CommunityForm';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { t } from '@/lib/strings';
import { rowToCommunityItem, rowToOrganization } from '@/lib/today';
import { isCommunityDynamicEngineEnabled } from '@/lib/pillar-flags';
import { rowToPillar, rowToPillarItem } from '@/lib/pillars';
import { PillarPageContent } from '@/components/pillars/PillarPageContent';
import { InstantiateTemplateButton } from '@/components/pillars/InstantiateTemplateButton';
import { COMMUNITY_TEMPLATE } from '@/lib/pillar-templates';

export const dynamic = 'force-dynamic';

const DONE_PAGE_SIZE = 20;
const CANCELLED_PAGE_SIZE = 20;

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ donePage?: string; cancPage?: string }>;
}) {
  const user = await requireUser();

  // Rollback flag — see docs/DYNAMIC_PILLARS.md and lib/pillar-flags.ts.
  // Set COMMUNITY_DYNAMIC_ENGINE=false to fall back to the path below
  // instantly. organizations/community_items are never touched by the
  // dynamic path, so flipping this back and forth is always safe.
  if (isCommunityDynamicEngineEnabled()) {
    return <DynamicCommunityPage userId={user.id} />;
  }

  const { donePage: donePageParam, cancPage: cancPageParam } = await searchParams;
  const donePage = Math.max(1, Number.parseInt(donePageParam ?? '1', 10) || 1);
  const cancPage = Math.max(1, Number.parseInt(cancPageParam ?? '1', 10) || 1);

  const [pendingRows, doneRows, [{ count: doneCount }], cancelledRows, [{ count: cancelledCount }], orgRows] = await Promise.all([
    db
      .select({ item: schema.communityItems, org_name: schema.organizations.name })
      .from(schema.communityItems)
      .leftJoin(schema.organizations, eq(schema.communityItems.organization_id, schema.organizations.id))
      .where(and(eq(schema.communityItems.status, 'pending'), eq(schema.communityItems.user_id, user.id)))
      .orderBy(asc(schema.communityItems.due_date)),
    db
      .select({ item: schema.communityItems, org_name: schema.organizations.name })
      .from(schema.communityItems)
      .leftJoin(schema.organizations, eq(schema.communityItems.organization_id, schema.organizations.id))
      .where(and(eq(schema.communityItems.status, 'done'), eq(schema.communityItems.user_id, user.id)))
      .orderBy(desc(schema.communityItems.created_at))
      .limit(DONE_PAGE_SIZE)
      .offset((donePage - 1) * DONE_PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.communityItems)
      .where(and(eq(schema.communityItems.status, 'done'), eq(schema.communityItems.user_id, user.id))),
    db
      .select({ item: schema.communityItems, org_name: schema.organizations.name })
      .from(schema.communityItems)
      .leftJoin(schema.organizations, eq(schema.communityItems.organization_id, schema.organizations.id))
      .where(and(eq(schema.communityItems.status, 'cancelled'), eq(schema.communityItems.user_id, user.id)))
      .orderBy(desc(schema.communityItems.created_at))
      .limit(CANCELLED_PAGE_SIZE)
      .offset((cancPage - 1) * CANCELLED_PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.communityItems)
      .where(and(eq(schema.communityItems.status, 'cancelled'), eq(schema.communityItems.user_id, user.id))),
    db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.user_id, user.id))
      .orderBy(asc(schema.organizations.name)),
  ]);

  const orgs = orgRows.map(rowToOrganization);
  const pending = pendingRows.map((r) => rowToCommunityItem(r.item, r.org_name ?? null));
  const done = doneRows.map((r) => rowToCommunityItem(r.item, r.org_name ?? null));
  const cancelled = cancelledRows.map((r) => rowToCommunityItem(r.item, r.org_name ?? null));
  const doneTotalPages = Math.max(1, Math.ceil(doneCount / DONE_PAGE_SIZE));
  const cancelledTotalPages = Math.max(1, Math.ceil(cancelledCount / CANCELLED_PAGE_SIZE));

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
        <EmptyState
          icon={Users}
          title={t('communityNoPending', user.settings.language)}
          description={t('communityNoPendingHint', user.settings.language)}
          action={<CommunityForm orgs={orgs} />}
        />
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

      {doneCount > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>completados ({doneCount})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {done.map((item) => (
                <CommitmentRow key={item.id} item={item} tz={user.settings.timezone} lang={user.settings.language} />
              ))}
            </div>
            <Pagination basePath="/community" page={donePage} totalPages={doneTotalPages} paramName="donePage" query={{ cancPage: cancPage > 1 ? String(cancPage) : undefined }} />
          </CardContent>
        </Card>
      )}

      {cancelledCount > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
            cancelados ({cancelledCount})
          </summary>
          <div className="mt-3 space-y-2">
            {cancelled.map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-surface-elev p-2.5 opacity-50">
                <p className="text-sm line-through">{item.title}</p>
                <span className="text-xs text-muted-foreground">{item.organization_name ?? '—'}</span>
              </div>
            ))}
          </div>
          <Pagination basePath="/community" page={cancPage} totalPages={cancelledTotalPages} paramName="cancPage" query={{ donePage: donePage > 1 ? String(donePage) : undefined }} />
        </details>
      )}
    </div>
  );
}

// Dynamic-engine path: reads from pillars/pillar_items (organizations as
// OPTIONAL containers, community items as their children — or as
// first-class ungrouped items when they have no organization) instead of
// organizations/community_items. Unlike Freelance's GenericGrid, the
// generic 'list' renderer (GenericList) needs the FULL item set, not just
// top-level items, since grouping happens inline rather than via a
// drill-down page. See docs/DYNAMIC_PILLARS.md.
async function DynamicCommunityPage({ userId }: { userId: string }) {
  const [pillarRow] = await db
    .select()
    .from(schema.pillars)
    .where(and(eq(schema.pillars.user_id, userId), eq(schema.pillars.key, COMMUNITY_TEMPLATE.key)))
    .limit(1);

  if (!pillarRow) {
    return (
      <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-3xl">
        <div className="mb-6 lg:mb-8">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">comunidad</p>
          <h2 className="text-2xl lg:text-3xl font-semibold mt-1">compromisos</h2>
        </div>
        <EmptyState
          icon={Layers}
          title="este pilar todavía no está activado"
          description="instanciá el template de comunidad para empezar a usar el motor dinámico."
          action={<InstantiateTemplateButton template={COMMUNITY_TEMPLATE} />}
        />
      </div>
    );
  }

  const pillar = rowToPillar(pillarRow);
  const itemRows = await db
    .select()
    .from(schema.pillarItems)
    .where(and(eq(schema.pillarItems.user_id, userId), eq(schema.pillarItems.pillar_id, pillar.id)))
    .orderBy(schema.pillarItems.position, schema.pillarItems.created_at);
  const items = itemRows.map(rowToPillarItem);

  return <PillarPageContent pillar={pillar} items={items} eyebrow="comunidad" basePath="/community" itemLabel="nuevo compromiso" />;
}
