import { asc, desc, eq, sql } from 'drizzle-orm';
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

export default async function WorkPage() {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(schema.workblocks)
    .where(eq(schema.workblocks.user_id, user.id))
    .orderBy(PRIORITY_ORDER, asc(schema.workblocks.position), desc(schema.workblocks.created_at));

  const workblocks = rows.map(rowToWorkblock);

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-[1600px]">
      <div className="mb-6 lg:mb-8">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
          work
        </p>
        <h2 className="text-2xl lg:text-3xl font-semibold mt-1">kanban</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {workblocks.length} workblocks totales · {workblocks.filter(w => w.status !== 'done').length} activos
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
      <KanbanBoard workblocks={workblocks} tz={user.settings.timezone} lang={user.settings.language} />
    </div>
  );
}
