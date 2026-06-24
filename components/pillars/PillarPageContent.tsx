import { GenericGrid } from '@/components/pillars/GenericGrid';
import { GenericList } from '@/components/pillars/GenericList';
import { PillarItemForm } from '@/components/pillars/PillarItemForm';
import type { Pillar, PillarItem } from '@/lib/types';

// Shared body for any page that renders one pillar's items by its
// view_type — used by the generic /p/[key] browser and by legacy routes
// (like /projects, /freelance, /community) once they're cut over to the
// dynamic engine, per docs/DYNAMIC_PILLARS.md. Keeping this in one place
// means both call sites stay in sync as new view types (kanban/custom) are
// added later.
//
// `items` contract depends on the pillar's grouping shape:
// - Hierarchy-required pillars (childView set, no groupByField, e.g.
//   Freelance): callers pass TOP-LEVEL items only (parent_item_id IS NULL)
//   — a container's children render on their own drill-down page.
// - Optional-grouping pillars (config.groupByField set, e.g. Community):
//   callers pass the FULL item set (containers + children + ungrouped) —
//   GenericList does its own grouping inline, there is no drill-down page.
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
  const isOptionalGrouping = Boolean(pillar.config.groupByField);
  const containers = isOptionalGrouping ? items.filter((i) => i.is_container) : undefined;

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-7xl">
      <div className="mb-6 lg:mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">{eyebrow}</p>
          <h2 className="text-2xl lg:text-3xl font-semibold mt-1">{pillar.name}</h2>
          {pillar.description && <p className="text-xs text-muted-foreground mt-1">{pillar.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {isOptionalGrouping ? (
            <>
              <PillarItemForm pillar={pillar} isContainer label="nueva organización" />
              <PillarItemForm
                pillar={pillar}
                containers={containers}
                statusWorkflow={pillar.config.childView?.status_workflow}
                label={itemLabel}
              />
            </>
          ) : (
            <PillarItemForm pillar={pillar} isContainer={Boolean(pillar.config.childView)} label={itemLabel} />
          )}
        </div>
      </div>

      {pillar.view_type === 'grid' && <GenericGrid pillar={pillar} items={items} basePath={basePath} />}
      {pillar.view_type === 'list' && <GenericList pillar={pillar} items={items} />}
      {pillar.view_type !== 'grid' && pillar.view_type !== 'list' && (
        <p className="text-sm text-muted-foreground">
          view_type &quot;{pillar.view_type}&quot; todavía no tiene un renderer genérico.
        </p>
      )}
    </div>
  );
}
