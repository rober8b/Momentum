// Predefined pillar templates — product config, not user data. Instantiating a
// template means inserting one `pillars` row copied from it (see
// docs/DYNAMIC_PILLARS.md, locked decision #6). Templates live in code and
// change via code review, not via the UI or a DB table.

import type { PillarConfig, PillarStatusStep, PillarViewType } from '@/lib/types';

export type PillarTemplate = {
  key: string;
  name: string;
  icon: string;
  description: string;
  view_type: PillarViewType;
  status_workflow: PillarStatusStep[];
  config: PillarConfig;
};

// Mirrors app/projects' own_projects status workflow exactly — this template
// is not a redesign of Projects, it's the same pillar expressed as data.
export const PROJECTS_TEMPLATE: PillarTemplate = {
  key: 'projects',
  name: 'Proyectos',
  icon: 'Rocket',
  description: 'Proyectos propios — side projects e ideas en desarrollo.',
  view_type: 'grid',
  status_workflow: [
    { key: 'active', label: 'activo', color: 'accent' },
    { key: 'paused', label: 'pausado', color: 'muted' },
    { key: 'blocked', label: 'bloqueado', color: 'danger' },
    { key: 'archived', label: 'archivado', color: 'muted', is_terminal: true },
  ],
  // cardFields: which fields the generic grid card surfaces, in order. Plain
  // keys read from the typed columns (status, description); 'fields.x' keys
  // read from the item's jsonb fields bag (see docs/DYNAMIC_PILLARS.md).
  config: {
    cardFields: ['description', 'status', 'fields.next_step', 'fields.last_update'],
  },
};

export const PILLAR_TEMPLATES: Record<string, PillarTemplate> = {
  projects: PROJECTS_TEMPLATE,
};
