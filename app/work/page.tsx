import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { Briefcase } from 'lucide-react';
import { KanbanBoard } from '@/components/work/KanbanBoard';
import { BlockForm } from '@/components/work/BlockForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { t } from '@/lib/strings';
import { rowToWorkblock } from '@/lib/today';

export const dynamic = 'force-dynamic';

const PRIORITY_ORDER = sql`case ${schema.workblocks.priority} when 'high' then 0 when 'med' then 1 when 'low' then 2 else 3 end`;

const DONE_PAGE_SIZE = 30;

export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{ donePage?: string }>;
}) {
  const user = await requireUser();
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
