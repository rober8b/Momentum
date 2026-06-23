import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rowToPillar, rowToPillarItem } from '@/lib/pillars';
import { PillarContainerPageContent } from '@/components/pillars/PillarContainerPageContent';

export const dynamic = 'force-dynamic';

// Generic container drill-down — a container item's children (e.g. one
// Freelance client's tasks). See docs/DYNAMIC_PILLARS.md.
export default async function PillarContainerPage({
  params,
}: {
  params: Promise<{ key: string; itemId: string }>;
}) {
  const user = await requireUser();
  const { key, itemId } = await params;

  const [pillarRow] = await db
    .select()
    .from(schema.pillars)
    .where(and(eq(schema.pillars.user_id, user.id), eq(schema.pillars.key, key)))
    .limit(1);
  if (!pillarRow) notFound();
  const pillar = rowToPillar(pillarRow);

  const [containerRow] = await db
    .select()
    .from(schema.pillarItems)
    .where(and(
      eq(schema.pillarItems.id, itemId),
      eq(schema.pillarItems.user_id, user.id),
      eq(schema.pillarItems.pillar_id, pillar.id),
      eq(schema.pillarItems.is_container, true),
    ))
    .limit(1);
  if (!containerRow) notFound();
  const container = rowToPillarItem(containerRow);

  const childRows = await db
    .select()
    .from(schema.pillarItems)
    .where(and(eq(schema.pillarItems.parent_item_id, container.id), eq(schema.pillarItems.user_id, user.id)))
    .orderBy(schema.pillarItems.position, schema.pillarItems.created_at);
  const children = childRows.map(rowToPillarItem);

  return <PillarContainerPageContent pillar={pillar} container={container} children={children} />;
}
