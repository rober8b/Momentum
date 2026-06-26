import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { Briefcase, Layers } from 'lucide-react';
import { KanbanBoard } from '@/components/work/KanbanBoard';
import { BlockForm } from '@/components/work/BlockForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { t } from '@/lib/strings';
import { rowToWorkblock } from '@/lib/today';
import { isWorkDynamicEngineEnabled } from '@/lib/pillar-flags';
import { rowToPillar, rowToPillarItem } from '@/lib/pillars';
import { PillarPageContent } from '@/components/pillars/PillarPageContent';
import { InstantiateTemplateButton } from '@/components/pillars/InstantiateTemplateButton';
import { WORK_TEMPLATE } from '@/lib/pillar-templates';

export const dynamic = 'force-dynamic';

const PRIORITY_ORDER = sql`case ${schema.workblocks.priority} when 'high' then 0 when 'med' then 1 when 'low' then 2 else 3 end`;

const DONE_PAGE_SIZE = 30;

export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{ donePage?: string }>;
}) {
  const user = await requireUser();

  // Rollback flag — see docs/DYNAMIC_PILLARS.md and lib/pillar-flags.ts.
  // Set WORK_DYNAMIC_ENGINE=false to fall back to the path below instantly,
  // no code revert needed. workblocks is never touched by the dynamic path,
  // so flipping this back and forth is always safe.
  if (isWorkDynamicEngineEnabled()) {
    return <DynamicWorkPage userId={user.id} />;
  }

  const { donePage: donePageParam } = await searchParams;
  const donePage = Math.max(1, Number.parseInt(donePageParam ?? '1', 10) || 1);
  const doneOffset = (donePage - 1) * DONE_PAGE_SIZE;

  const [activeRows, doneRows, [{ count: doneCount }]] = await Promise.all([
    db
      .select()
      .from(schema.workblocks)
      .where(and(eq(schema.workblocks.user_id, user.id), ne(schema.workblocks.status, 'done')))
      .orderBy(PRIORITY_ORDER, asc(schema.workblocks.position), desc(schema.workblocks.created_at)),
    db
      .select()
      .from(schema.workblocks)
      .where(and(eq(schema.workblocks.user_id, user.id), eq(schema.workblocks.status, 'done')))
      .orderBy(desc(schema.workblocks.created_at))
      .limit(DONE_PAGE_SIZE)
      .offset(doneOffset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.workblocks)
      .where(and(eq(schema.workblocks.user_id, user.id), eq(schema.workblocks.status, 'done'))),
  ]);

  const activeWorkblocks = activeRows.map(rowToWorkblock);
  const doneWorkblocks = doneRows.map(rowToWorkblock);
  const workblocks = [...activeWorkblocks, ...doneWorkblocks];
  const doneTotalPages = Math.max(1, Math.ceil(doneCount / DONE_PAGE_SIZE));

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-[1600px]">
      <div className="mb-6 lg:mb-8">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
          work
        </p>
        <h2 className="text-2xl lg:text-3xl font-semibold mt-1">kanban</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {doneCount + activeWorkblocks.length} workblocks totales · {activeWorkblocks.length} activos
        </p>
      </div>
      {workblocks.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title={t('workNoWorkblocks', user.settings.language)}
          description={t('workNoWorkblocksHint', user.settings.language)}
          action={<div className="w-full max-w-sm"><BlockForm defaultStatus="today" /></div>}
        />
      )}
      <KanbanBoard
        workblocks={workblocks}
        tz={user.settings.timezone}
        lang={user.settings.language}
        donePage={donePage}
        doneTotalPages={doneTotalPages}
        doneCount={doneCount}
      />
    </div>
  );
}

// Dynamic-engine path: reads from pillars/pillar_items instead of
// workblocks, reusing the exact same PillarPageContent/GenericKanban as the
// generic /p/[key] browser. See docs/DYNAMIC_PILLARS.md, Phase 6c. No
// done-bucket pagination here — same accepted gap as Projects/Freelance's
// dynamic paths ("fine at personal-app scale", per the design doc).
async function DynamicWorkPage({ userId }: { userId: string }) {
  const [pillarRow] = await db
    .select()
    .from(schema.pillars)
    .where(and(eq(schema.pillars.user_id, userId), eq(schema.pillars.key, WORK_TEMPLATE.key)))
    .limit(1);

  if (!pillarRow) {
    return (
      <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-[1600px]">
        <div className="mb-6 lg:mb-8">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">work</p>
          <h2 className="text-2xl lg:text-3xl font-semibold mt-1">kanban</h2>
        </div>
        <EmptyState
          icon={Layers}
          title="este pilar todavía no está activado"
          description="instanciá el template de work para empezar a usar el motor dinámico."
          action={<InstantiateTemplateButton template={WORK_TEMPLATE} />}
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

  return <PillarPageContent pillar={pillar} items={items} eyebrow="work" itemLabel="nuevo workblock" />;
}
