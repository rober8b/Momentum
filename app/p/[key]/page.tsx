import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rowToPillar, rowToPillarItem } from '@/lib/pillars';
import { GenericGrid } from '@/components/pillars/GenericGrid';
import { PillarItemForm } from '@/components/pillars/PillarItemForm';

export const dynamic = 'force-dynamic';

// Generic pillar renderer — picks the view component by pillar.view_type.
// Only 'grid' exists this sprint (proven on Projects); list/kanban/custom
// follow the same pattern later. See docs/DYNAMIC_PILLARS.md.
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
    .where(and(eq(schema.pillarItems.user_id, user.id), eq(schema.pillarItems.pillar_id, pillar.id)))
    .orderBy(schema.pillarItems.position, schema.pillarItems.created_at);
  const items = itemRows.map(rowToPillarItem);

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-7xl">
      <div className="mb-6 lg:mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">pilar dinámico</p>
          <h2 className="text-2xl lg:text-3xl font-semibold mt-1">{pillar.name}</h2>
          {pillar.description && <p className="text-xs text-muted-foreground mt-1">{pillar.description}</p>}
        </div>
        <PillarItemForm pillar={pillar} />
      </div>

      {pillar.view_type === 'grid' && <GenericGrid pillar={pillar} items={items} />}
      {pillar.view_type !== 'grid' && (
        <p className="text-sm text-muted-foreground">
          view_type &quot;{pillar.view_type}&quot; todavía no tiene un renderer genérico — fuera de scope de Sprint B.
        </p>
      )}
    </div>
  );
}
