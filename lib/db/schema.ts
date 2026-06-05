// Drizzle schema — espejo del SQL en supabase/schema.sql (que ahora corre en Railway).
// Cambios en este archivo se reflejan al correr `npx drizzle-kit push`.

import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  date,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import type {
  ScheduleSlot,
  AssignmentStatus,
  WorkblockStatus,
  WorkblockPriority,
  WorkblockType,
  BuildType,
  BuildStatus,
  FreelanceClientStatus,
  FreelanceTaskStatus,
  ProjectStatus,
  CommunityOrg,
  CommunityStatus,
} from '@/lib/types';

// ---------- UNIVERSIDAD ----------

export const subjects = pgTable('subjects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  semester: text('semester').notNull(),
  schedule: jsonb('schedule').$type<ScheduleSlot[]>().default([]).notNull(),
  active: boolean('active').default(true).notNull(),
  vault_slug: text('vault_slug'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subject_id: uuid('subject_id').references(() => subjects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    due_date: date('due_date'),
    status: text('status').$type<AssignmentStatus>().default('todo').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('assignments_subject_idx').on(t.subject_id),
    index('assignments_status_idx').on(t.status),
    index('assignments_due_idx').on(t.due_date),
  ],
);

// ---------- TRABAJO (Aleph) ----------

export const workblocks = pgTable(
  'workblocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').$type<WorkblockType>().default('task').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').$type<WorkblockStatus>().default('backlog').notNull(),
    priority: text('priority').$type<WorkblockPriority>().default('med').notNull(),
    due_date: date('due_date'),
    client: text('client').default('aleph').notNull(),
    notes: text('notes'),
    links: jsonb('links').$type<Record<string, string>>().default({}).notNull(),
    position: integer('position').default(0).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('workblocks_status_idx').on(t.status),
    index('workblocks_priority_idx').on(t.priority),
    index('workblocks_position_idx').on(t.status, t.position),
  ],
);

// ---------- BUILD-IN-PUBLIC ----------

export const buildItems = pgTable(
  'build_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').$type<BuildType>().default('project').notNull(),
    title: text('title').notNull(),
    draft: text('draft'),
    hook: text('hook'),
    platforms: text('platforms').array().default(['x', 'linkedin']).notNull(),
    status: text('status').$type<BuildStatus>().default('idea').notNull(),
    scheduled_for: timestamp('scheduled_for', { withTimezone: true }),
    published_at: timestamp('published_at', { withTimezone: true }),
    links: jsonb('links').$type<Record<string, string>>().default({}).notNull(),
    metrics: jsonb('metrics').$type<Record<string, number>>().default({}).notNull(),
    related_project: text('related_project'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('build_items_status_idx').on(t.status),
    index('build_items_published_idx').on(t.published_at),
  ],
);

// ---------- EXPORT TRACKING ----------

export const vaultExports = pgTable('vault_exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  exported_at: timestamp('exported_at', { withTimezone: true }).defaultNow().notNull(),
  item_count: integer('item_count').default(0).notNull(),
  items: jsonb('items')
    .$type<Array<{ type: string; id: string; title: string }>>()
    .default([])
    .notNull(),
  status: text('status').$type<'success' | 'failure' | 'partial'>().default('success').notNull(),
  error: text('error'),
});

// ---------- FREELANCE ----------

export const freelanceClients = pgTable(
  'freelance_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    icon: text('icon'),
    description: text('description'),
    status: text('status').$type<FreelanceClientStatus>().default('active').notNull(),
    stack: text('stack'),
    next_step: text('next_step'),
    last_update: text('last_update'),
    links: jsonb('links').$type<Record<string, string>>().default({}).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('freelance_clients_status_idx').on(t.status),
  ],
);

export const freelanceTasks = pgTable(
  'freelance_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    client_id: uuid('client_id').references(() => freelanceClients.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').$type<FreelanceTaskStatus>().default('backlog').notNull(),
    priority: text('priority').$type<WorkblockPriority>().default('med').notNull(),
    due_date: date('due_date'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('freelance_tasks_client_idx').on(t.client_id),
    index('freelance_tasks_status_idx').on(t.status),
  ],
);

// ---------- PROYECTOS PROPIOS ----------

export const ownProjects = pgTable(
  'own_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    icon: text('icon'),
    description: text('description'),
    status: text('status').$type<ProjectStatus>().default('active').notNull(),
    last_update: text('last_update'),
    next_step: text('next_step'),
    links: jsonb('links').$type<Record<string, string>>().default({}).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('own_projects_status_idx').on(t.status),
  ],
);

// ---------- COMUNIDAD ----------

export const communityItems = pgTable(
  'community_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization: text('organization').$type<CommunityOrg>().notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').$type<CommunityStatus>().default('pending').notNull(),
    due_date: date('due_date'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('community_items_org_idx').on(t.organization),
    index('community_items_status_idx').on(t.status),
  ],
);

// ---------- TYPES ----------

export type SubjectRow = typeof subjects.$inferSelect;
export type SubjectInsert = typeof subjects.$inferInsert;
export type AssignmentRow = typeof assignments.$inferSelect;
export type AssignmentInsert = typeof assignments.$inferInsert;
export type WorkblockRow = typeof workblocks.$inferSelect;
export type WorkblockInsert = typeof workblocks.$inferInsert;
export type BuildItemRow = typeof buildItems.$inferSelect;
export type BuildItemInsert = typeof buildItems.$inferInsert;
export type FreelanceClientRow = typeof freelanceClients.$inferSelect;
export type FreelanceClientInsert = typeof freelanceClients.$inferInsert;
export type FreelanceTaskRow = typeof freelanceTasks.$inferSelect;
export type FreelanceTaskInsert = typeof freelanceTasks.$inferInsert;
export type OwnProjectRow = typeof ownProjects.$inferSelect;
export type OwnProjectInsert = typeof ownProjects.$inferInsert;
export type CommunityItemRow = typeof communityItems.$inferSelect;
export type CommunityItemInsert = typeof communityItems.$inferInsert;
