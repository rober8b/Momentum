import Link from 'next/link';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { Plus, Lightbulb, FileText, Send, Ban, ArchiveRestore } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IdeaCard } from '@/components/build/IdeaCard';
import { DraftCard, PublishedRow } from '@/components/build/DraftCard';
import { DiscardedRow } from '@/components/build/DiscardedRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { t } from '@/lib/strings';
import { rowToBuildItem, pillarItemToBuildItem } from '@/lib/today';
import { rowToPillarItem } from '@/lib/pillars';
import { isBuildDynamicEngineEnabled } from '@/lib/pillar-flags';
import { BUILD_TEMPLATE } from '@/lib/pillar-templates';
import type { BuildItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PUB_PAGE_SIZE = 20;
const DISC_PAGE_SIZE = 20;

// Phase 6a: published/discarded must stay paginated at the SQL level (the
// project's "lo histórico se pagina" convention) even on the dynamic-engine
// path — no Generic* component supports pagination, so this queries
// pillar_items directly with the same count()+limit()+offset() shape the
// legacy query already used, just swapping the table and adding the pillar
// filter. The active bucket (idea/draft/scheduled) stays unfiltered, same
// reasoning Uni/Freelance/Community already rely on (bounded by nature).
async function fetchBuildItemsDynamic(userId: string, pubPage: number, discPage: number) {
  const [pillarRow] = await db
    .select({ id: schema.pillars.id })
    .from(schema.pillars)
    .where(and(eq(schema.pillars.user_id, userId), eq(schema.pillars.key, BUILD_TEMPLATE.key)))
    .limit(1);

  if (!pillarRow) {
    return { activeItems: [] as BuildItem[], published: [] as BuildItem[], pubCount: 0, discarded: [] as BuildItem[], discCount: 0 };
  }

  const [activeRows, pubRows, [{ count: pubCount }], discRows, [{ count: discCount }]] = await Promise.all([
    db
      .select()
      .from(schema.pillarItems)
      .where(and(eq(schema.pillarItems.pillar_id, pillarRow.id), inArray(schema.pillarItems.status, ['idea', 'draft', 'scheduled'])))
      .orderBy(desc(schema.pillarItems.created_at)),
    db
      .select()
      .from(schema.pillarItems)
      .where(and(eq(schema.pillarItems.pillar_id, pillarRow.id), eq(schema.pillarItems.status, 'published')))
      .orderBy(desc(schema.pillarItems.created_at))
      .limit(PUB_PAGE_SIZE)
      .offset((pubPage - 1) * PUB_PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.pillarItems)
      .where(and(eq(schema.pillarItems.pillar_id, pillarRow.id), eq(schema.pillarItems.status, 'published'))),
    db
      .select()
      .from(schema.pillarItems)
      .where(and(eq(schema.pillarItems.pillar_id, pillarRow.id), eq(schema.pillarItems.status, 'discarded')))
      .orderBy(desc(schema.pillarItems.created_at))
      .limit(DISC_PAGE_SIZE)
      .offset((discPage - 1) * DISC_PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.pillarItems)
      .where(and(eq(schema.pillarItems.pillar_id, pillarRow.id), eq(schema.pillarItems.status, 'discarded'))),
  ]);

  return {
    activeItems: activeRows.map(rowToPillarItem).map(pillarItemToBuildItem),
    published: pubRows.map(rowToPillarItem).map(pillarItemToBuildItem),
    pubCount,
    discarded: discRows.map(rowToPillarItem).map(pillarItemToBuildItem),
    discCount,
  };
}

export default async function BuildPage({
  searchParams,
}: {
  searchParams: Promise<{ pubPage?: string; discPage?: string }>;
}) {
  const user = await requireUser();
  const { pubPage: pubPageParam, discPage: discPageParam } = await searchParams;
  const pubPage = Math.max(1, Number.parseInt(pubPageParam ?? '1', 10) || 1);
  const discPage = Math.max(1, Number.parseInt(discPageParam ?? '1', 10) || 1);

  let activeItems: BuildItem[];
  let published: BuildItem[];
  let pubCount: number;
  let discarded: BuildItem[];
  let discCount: number;

  if (isBuildDynamicEngineEnabled()) {
    const result = await fetchBuildItemsDynamic(user.id, pubPage, discPage);
    activeItems = result.activeItems;
    published = result.published;
    pubCount = result.pubCount;
    discarded = result.discarded;
    discCount = result.discCount;
  } else {
    const [activeRows, pubRows, [{ count: pubCountRow }], discRows, [{ count: discCountRow }]] = await Promise.all([
      db
        .select()
        .from(schema.buildItems)
        .where(and(eq(schema.buildItems.user_id, user.id), inArray(schema.buildItems.status, ['idea', 'draft', 'scheduled'])))
        .orderBy(desc(schema.buildItems.created_at)),
      db
        .select()
        .from(schema.buildItems)
        .where(and(eq(schema.buildItems.user_id, user.id), eq(schema.buildItems.status, 'published')))
        .orderBy(desc(schema.buildItems.created_at))
        .limit(PUB_PAGE_SIZE)
        .offset((pubPage - 1) * PUB_PAGE_SIZE),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.buildItems)
        .where(and(eq(schema.buildItems.user_id, user.id), eq(schema.buildItems.status, 'published'))),
      db
        .select()
        .from(schema.buildItems)
        .where(and(eq(schema.buildItems.user_id, user.id), eq(schema.buildItems.status, 'discarded')))
        .orderBy(desc(schema.buildItems.created_at))
        .limit(DISC_PAGE_SIZE)
        .offset((discPage - 1) * DISC_PAGE_SIZE),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.buildItems)
        .where(and(eq(schema.buildItems.user_id, user.id), eq(schema.buildItems.status, 'discarded'))),
    ]);
    activeItems = activeRows.map(rowToBuildItem);
    published = pubRows.map(rowToBuildItem);
    pubCount = pubCountRow;
    discarded = discRows.map(rowToBuildItem);
    discCount = discCountRow;
  }

  const ideas = activeItems.filter((i) => i.status === 'idea');
  const drafts = activeItems.filter((i) => i.status === 'draft');
  const scheduled = activeItems.filter((i) => i.status === 'scheduled');
  const pubTotalPages = Math.max(1, Math.ceil(pubCount / PUB_PAGE_SIZE));
  const discTotalPages = Math.max(1, Math.ceil(discCount / DISC_PAGE_SIZE));
  const totalItems = ideas.length + drafts.length + scheduled.length + pubCount + discCount;

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-[1400px]">
      <div className="mb-6 lg:mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            build-in-public
          </p>
          <h2 className="text-2xl lg:text-3xl font-semibold mt-1">tracker</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {ideas.length} ideas · {drafts.length} drafts · {pubCount} publicados{discCount > 0 ? ` · ${discCount} descartados` : ''}
          </p>
        </div>
        <Link href="/build/new">
          <Button size="md">
            <Plus size={14} />
            nuevo
          </Button>
        </Link>
      </div>

      {totalItems === 0 && (
        <EmptyState
          icon={Lightbulb}
          title={t('buildNoItems', user.settings.language)}
          description={t('buildNoItemsHint', user.settings.language)}
          action={
            <Link href="/build/new">
              <Button size="md">
                <Plus size={14} />
                nuevo
              </Button>
            </Link>
          }
        />
      )}

      {totalItems > 0 && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>
              <Lightbulb size={14} className="inline mr-1.5 -mt-0.5" />
              ideas ({ideas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-2 min-h-[400px]">
            {ideas.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                capturá una idea desde la Today view, o<br />
                <Link href="/build/new" className="text-accent hover:underline">crear directamente →</Link>
              </p>
            ) : (
              ideas.map((i) => <IdeaCard key={i.id} item={i} />)
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>
              <FileText size={14} className="inline mr-1.5 -mt-0.5" />
              drafts ({drafts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-2 min-h-[400px]">
            {drafts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                pasá una idea a draft<br />escribiendo hook + cuerpo.
              </p>
            ) : (
              drafts.map((i) => <DraftCard key={i.id} item={i} />)
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>
              <Send size={14} className="inline mr-1.5 -mt-0.5" />
              publicados ({pubCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-2 min-h-[400px]">
            {published.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                sin publicaciones todavía.
              </p>
            ) : (
              published.map((i) => <PublishedRow key={i.id} item={i} />)
            )}
            <Pagination basePath="/build" page={pubPage} totalPages={pubTotalPages} paramName="pubPage" query={{ discPage: discPage > 1 ? String(discPage) : undefined }} />
          </CardContent>
        </Card>
      </div>
      )}

      {discCount > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <Ban size={12} /> descartados ({discCount})
          </summary>
          <div className="mt-3 space-y-2">
            {discarded.map((i) => (
              <DiscardedRow key={i.id} item={i} />
            ))}
          </div>
          <Pagination basePath="/build" page={discPage} totalPages={discTotalPages} paramName="discPage" query={{ pubPage: pubPage > 1 ? String(pubPage) : undefined }} />
        </details>
      )}
    </div>
  );
}
