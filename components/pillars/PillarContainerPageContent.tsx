import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { GenericKanban } from '@/components/pillars/GenericKanban';
import { GenericList } from '@/components/pillars/GenericList';
import { PillarItemForm } from '@/components/pillars/PillarItemForm';
import { badgeVariant } from '@/components/pillars/pillar-render-utils';
import { getChildViewConfig } from '@/lib/pillars';
import type { Pillar, PillarItem } from '@/lib/types';

// Shared body for a container item's drill-down page (e.g. one Freelance
// client's tasks) — the child-level counterpart to PillarPageContent. Used
// by the generic /p/[key]/[itemId] browser and by legacy routes (like
// /freelance/[client]) once cut over. See docs/DYNAMIC_PILLARS.md locked
// decision #3.
export function PillarContainerPageContent({
  pillar,
  container,
  children,
  basePath,
  childLabel = 'nuevo item',
}: {
  pillar: Pillar;
  container: PillarItem;
  children: PillarItem[];
  basePath?: string;
  childLabel?: string;
}) {
  const resolvedBasePath = basePath ?? `/p/${pillar.key}`;
  const childView = getChildViewConfig(pillar);
  const step = pillar.status_workflow.find((s) => s.key === container.status);

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-[1400px]">
      <Link href={resolvedBasePath} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent mb-6">
        <ArrowLeft size={12} /> {pillar.name.toLowerCase()}
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          {step && <Badge variant={badgeVariant(step.color)}>{step.label}</Badge>}
          <h1 className="text-2xl lg:text-3xl font-semibold mt-2">{container.title}</h1>
          {container.description && <p className="text-sm text-muted-foreground mt-1">{container.description}</p>}
        </div>
        {childView && (
          <PillarItemForm pillar={pillar} parentItem={container} statusWorkflow={childView.status_workflow} label={childLabel} />
        )}
      </div>

      {childView?.view_type === 'kanban' && (
        <GenericKanban items={children} workflow={childView.status_workflow} cardFields={childView.cardFields} />
      )}
      {childView?.view_type === 'list' && (
        <GenericList pillar={pillar} items={children} sortField={childView.sortField} />
      )}
      {(!childView || (childView.view_type !== 'kanban' && childView.view_type !== 'list')) && (
        <p className="text-sm text-muted-foreground">este pilar no tiene un childView configurado todavía.</p>
      )}
    </div>
  );
}
