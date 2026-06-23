// Row mappers for the dynamic pillar engine — mirrors the convention in
// lib/today.ts (hard rule 7: pages get the same shape back, timestamps as
// ISO strings, never a raw Date). See docs/DYNAMIC_PILLARS.md for the design.

import type { PillarRow, PillarItemRow } from '@/lib/db/schema';
import type { ChildViewConfig, Pillar, PillarItem, PillarStatusStep } from '@/lib/types';

export function rowToPillar(r: PillarRow): Pillar {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    icon: r.icon,
    description: r.description,
    position: r.position,
    view_type: r.view_type,
    status_workflow: r.status_workflow,
    config: r.config,
    source_template: r.source_template,
    is_archived: r.is_archived,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}

export function rowToPillarItem(r: PillarItemRow): PillarItem {
  return {
    id: r.id,
    pillar_id: r.pillar_id,
    parent_item_id: r.parent_item_id,
    is_container: r.is_container,
    title: r.title,
    description: r.description,
    status: r.status,
    due_date: r.due_date,
    completed_at: r.completed_at ? r.completed_at.toISOString() : null,
    position: r.position,
    fields: r.fields,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}

// Hierarchical pillars (Freelance: client -> task) keep two status
// workflows — the pillar's own (for container items) and config.childView's
// (for items with a parent). Centralizing the lookup here means every call
// site (actions, views) picks the right one the same way. See
// docs/DYNAMIC_PILLARS.md locked decision #3.
export function getChildViewConfig(pillar: Pillar): ChildViewConfig | null {
  return pillar.config.childView ?? null;
}

export function statusWorkflowFor(pillar: Pillar, hasParent: boolean): PillarStatusStep[] {
  if (hasParent) {
    const childView = getChildViewConfig(pillar);
    if (childView) return childView.status_workflow;
  }
  return pillar.status_workflow;
}
