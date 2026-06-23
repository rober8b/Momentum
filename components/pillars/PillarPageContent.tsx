import { GenericGrid } from '@/components/pillars/GenericGrid';
import { PillarItemForm } from '@/components/pillars/PillarItemForm';
import type { Pillar, PillarItem } from '@/lib/types';

// Shared body for any page that renders one pillar's TOP-LEVEL items by its
// view_type — used by the generic /p/[key] browser and by legacy routes
// (like /projects, /freelance) once they're cut over to the dynamic engine,
// per docs/DYNAMIC_PILLARS.md. Keeping this in one place means both call
// sites stay in sync as new view types (list/kanban/custom) are added later.
// Callers are expected to have already filtered `items` to top-level only
// (parent_item_id IS NULL) — a container's children render on their own
// drill-down page, not mixed into this one.
export function PillarPageContent({
  pillar,
  items,
  eyebrow = 'pilar dinámico',
  basePath,
  itemLabel = 'nuevo item',
}: {
  pillar: Pillar;
  items: PillarItem[];
  eyebrow?: string;
  basePath?: string;
  itemLabel?: string;
}) {
  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-7xl">
      <div className="mb-6 lg:mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">{eyebrow}</p>
          <h2 className="text-2xl lg:text-3xl font-semibold mt-1">{pillar.name}</h2>
          {pillar.description && <p className="text-xs text-muted-foreground mt-1">{pillar.description}</p>}
        </div>
        <PillarItemForm pillar={pillar} isContainer={Boolean(pillar.config.childView)} label={itemLabel} />
      </div>

      {pillar.view_type === 'grid' && <GenericGrid pillar={pillar} items={items} basePath={basePath} />}
      {pillar.view_type !== 'grid' && (
        <p className="text-sm text-muted-foreground">
          view_type &quot;{pillar.view_type}&quot; todavía no tiene un renderer genérico.
        </p>
      )}
    </div>
  );
}
