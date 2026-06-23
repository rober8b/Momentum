import { notFound } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rowToPillar, rowToPillarItem } from '@/lib/pillars';
import { PillarPageContent } from '@/components/pillars/PillarPageContent';

export const dynamic = 'force-dynamic';

// Generic pillar browser by key — top-level items only. A container's
// children render on /p/[key]/[itemId], not mixed in here. See
// docs/DYNAMIC_PILLARS.md.
export default async function PillarPage({ params }: { params: Promise<{ key: string }> }) {
  const user = await requireUser();
  const { key } = await params;

  const [pillarRow] = await db
    .select()
    .from(schema.pillars)
    .where(and(eq(schema.pillars.user_id, user.id), eq(schema.pillars.key, key)))
    .limit(1);
  if (!pillarRow) notFound();
  const pillar = rowToPillar(pillarRow);

  const itemRows = await db
    .select()
    .from(schema.pillarItems)
    .where(and(
      eq(schema.pillarItems.user_id, user.id),
      eq(schema.pillarItems.pillar_id, pillar.id),
      isNull(schema.pillarItems.parent_item_id),
    ))
    .orderBy(schema.pillarItems.position, schema.pillarItems.created_at);
  const items = itemRows.map(rowToPillarItem);

  return <PillarPageContent pillar={pillar} items={items} />;
}
