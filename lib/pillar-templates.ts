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

// Community is the first OPTIONAL-grouping pillar: organizations are
// containers, community items are children — but unlike Freelance, a child
// item may have NO parent (organization_id was nullable on the legacy
// table). Ungrouped items are first-class, not an error case. The pillar's
// own status_workflow is a trivial single state for containers (an
// organization has no real status of its own); the actual workflow
// (pending/done/cancelled) lives on config.childView and applies to every
// non-container item, grouped or not — see lib/pillars.ts's
// statusWorkflowFor, which picks by is_container rather than by whether a
// parent is set, specifically so ungrouped items still get the right
// workflow. config.groupByField/sortField select the 'list' renderer's
// optional-grouping mode. See docs/DYNAMIC_PILLARS.md.
export const COMMUNITY_TEMPLATE: PillarTemplate = {
  key: 'community',
  name: 'Comunidad',
  icon: 'Users',
  description: 'Organizaciones y compromisos de comunidad — la organización es opcional.',
  view_type: 'list',
  status_workflow: [{ key: 'active', label: 'activa', color: 'muted' }],
  config: {
    groupByField: 'parent_item_id',
    sortField: 'due_date',
    childView: {
      view_type: 'list',
      status_workflow: [
        { key: 'pending', label: 'pendiente', color: 'accent' },
        { key: 'done', label: 'hecho', color: 'success', is_terminal: true },
        { key: 'cancelled', label: 'cancelado', color: 'muted', is_terminal: true },
      ],
      cardFields: ['description', 'due_date'],
    },
  },
};

// Uni is the first 'custom' view_type pillar: subjects are containers
// (hierarchy-required, like Freelance — every assignment belongs to a
// subject in practice, though the legacy schema's nullable subject_id is
// still handled defensively by the migration, same skip-with-warning
// treatment migrate-freelance.ts gives an orphaned task). What makes it
// "custom" is the weekly schedule: each subject's schedule lives in
// fields.schedule on its container item, rendered by a registered
// 'uni-schedule' renderer (see components/pillars/custom-renderers.tsx) —
// the escape hatch docs/DYNAMIC_PILLARS.md always intended for exotic
// views, not something the generic grid/list/kanban engine should try to
// express. Assignments (children) use the generic 'list' view, sorted by
// due_date via config.childView.sortField.
export const UNI_TEMPLATE: PillarTemplate = {
  key: 'uni',
  name: 'Uni',
  icon: 'GraduationCap',
  description: 'Materias y TPs.',
  view_type: 'custom',
  // Mirrors subjects.active (boolean) as a two-state workflow so the
  // mapping is lossless — the legacy column doesn't have a UI to toggle it
  // today, but the migration round-trips it either way.
  status_workflow: [
    { key: 'active', label: 'activa', color: 'accent' },
    { key: 'inactive', label: 'inactiva', color: 'muted', is_terminal: true },
  ],
  config: {
    renderer: 'uni-schedule',
    childView: {
      view_type: 'list',
      status_workflow: [
        { key: 'todo', label: 'todo', color: 'muted' },
        { key: 'in-progress', label: 'en progreso', color: 'warning' },
        { key: 'done', label: 'hecho', color: 'success', is_terminal: true },
      ],
      cardFields: ['description', 'due_date'],
      sortField: 'due_date',
    },
  },
};

export const PILLAR_TEMPLATES: Record<string, PillarTemplate> = {
  projects: PROJECTS_TEMPLATE,
  freelance: FREELANCE_TEMPLATE,
  community: COMMUNITY_TEMPLATE,
  uni: UNI_TEMPLATE,
};
