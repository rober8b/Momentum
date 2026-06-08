import { and, asc, ne, eq } from 'drizzle-orm';
import { CommitmentRow } from '@/components/community/CommitmentRow';
import { CommunityForm } from '@/components/community/CommunityForm';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rowToCommunityItem } from '@/lib/today';
import type { CommunityOrg } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ORG_LABELS: Record<CommunityOrg, string> = {
  'ai-consensus': 'AI Consensus',
  'levellers': 'The Levellers',
  'xplora': 'Xplora UCEMA',
  'other': 'Otros',
};

const ORGS: CommunityOrg[] = ['ai-consensus', 'levellers', 'xplora', 'other'];

export default async function CommunityPage() {
  const user = await requireUser();

  const [activeRows, cancelledRows] = await Promise.all([
    db
      .select()
      .from(schema.communityItems)
      .where(and(ne(schema.communityItems.status, 'cancelled'), eq(schema.communityItems.user_id, user.id)))
      .orderBy(asc(schema.communityItems.due_date)),
    db
      .select()
      .from(schema.communityItems)
      .where(and(eq(schema.communityItems.status, 'cancelled'), eq(schema.communityItems.user_id, user.id)))
      .orderBy(asc(schema.communityItems.created_at)),
  ]);

  const items = activeRows.map(rowToCommunityItem);
  const cancelled = cancelledRows.map(rowToCommunityItem);
  const pending = items.filter((i) => i.status === 'pending');
  const done = items.filter((i) => i.status === 'done');

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
        <CommunityForm />
      </div>

      {ORGS.map((org) => {
        const orgItems = pending.filter((i) => i.organization === org);
        if (orgItems.length === 0) return null;
        return (
          <Card key={org} className="mb-4">
            <CardHeader>
              <CardTitle>{ORG_LABELS[org]}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {orgItems.map((item) => (
                  <CommitmentRow key={item.id} item={item} tz={user.settings.timezone} />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {pending.length === 0 && (
        <p className="text-xs text-muted-foreground py-10 text-center">
          no hay compromisos pendientes. agregá uno con el botón de arriba.
        </p>
      )}

      {done.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>completados ({done.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {done.slice(0, 10).map((item) => (
                <CommitmentRow key={item.id} item={item} tz={user.settings.timezone} />
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
                <span className="text-xs text-muted-foreground">{item.organization}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
