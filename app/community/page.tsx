import { asc, ne } from 'drizzle-orm';
import { CommitmentRow } from '@/components/community/CommitmentRow';
import { CommunityForm } from '@/components/community/CommunityForm';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { db, schema } from '@/lib/db';
import { requireRober } from '@/lib/auth';
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
  await requireRober();

  const rows = await db
    .select()
    .from(schema.communityItems)
    .where(ne(schema.communityItems.status, 'cancelled'))
    .orderBy(asc(schema.communityItems.due_date));

  const items = rows.map(rowToCommunityItem);
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
                  <CommitmentRow key={item.id} item={item} />
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
        <Card>
          <CardHeader>
            <CardTitle>completados ({done.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {done.slice(0, 10).map((item) => (
                <CommitmentRow key={item.id} item={item} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
