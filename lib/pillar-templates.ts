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

// Freelance is the first hierarchical pillar: clients are containers
// (is_container: true), tasks are children (parent_item_id pointing at a
// client). The two levels have different status workflows and different
// view types — clients are a grid of cards, tasks per-client are a kanban —
// so the child level gets its own status_workflow/view_type/cardFields in
// config.childView rather than sharing the pillar's top-level
// status_workflow. See docs/DYNAMIC_PILLARS.md locked decision #3.
export const FREELANCE_TEMPLATE: PillarTemplate = {
  key: 'freelance',
  name: 'Freelance',
  icon: 'Briefcase',
  description: 'Clientes freelance y sus tareas.',
  view_type: 'grid',
  status_workflow: [
    { key: 'active', label: 'activo', color: 'accent' },
    { key: 'paused', label: 'pausado', color: 'muted' },
    { key: 'blocked', label: 'bloqueado', color: 'danger' },
    { key: 'archived', label: 'archivado', color: 'muted', is_terminal: true },
  ],
  config: {
    cardFields: ['description', 'status', 'fields.stack', 'fields.next_step', 'fields.last_update'],
    childView: {
      view_type: 'kanban',
      status_workflow: [
        { key: 'backlog', label: 'backlog', color: 'muted' },
        { key: 'today', label: 'hoy', color: 'accent' },
        { key: 'in-progress', label: 'en progreso', color: 'warning' },
        { key: 'blocked', label: 'bloqueado', color: 'danger' },
        { key: 'done', label: 'hecho', color: 'success', is_terminal: true },
      ],
      cardFields: ['fields.priority'],
    },
  },
};

export const PILLAR_TEMPLATES: Record<string, PillarTemplate> = {
  projects: PROJECTS_TEMPLATE,
  freelance: FREELANCE_TEMPLATE,
};
