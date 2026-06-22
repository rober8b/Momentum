// Drizzle schema — source of truth for the DB.
// Changes here are reflected by running `npx drizzle-kit push` (dev) or `drizzle-kit generate` (prod).

import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  date,
  timestamp,
  integer,
  bigint,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  UserRole,
  UserPlan,
  UserPlanStatus,
  UserSettings,
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
  CommunityStatus,
  ApiScope,
  OAuthProvider,
} from '@/lib/types';

// ---------- USERS ----------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    display_name: text('display_name'),
    // Nullable: OAuth-only users have no password.
    password_hash: text('password_hash'),
    role: text('role').$type<UserRole>().default('member').notNull(),
    active: boolean('active').default(true).notNull(),
    plan: text('plan').$type<UserPlan>().default('free').notNull(),
    plan_status: text('plan_status').$type<UserPlanStatus>().default('active').notNull(),
    polar_customer_id: text('polar_customer_id'),
    polar_subscription_id: text('polar_subscription_id'),
    settings: jsonb('settings').$type<UserSettings>().default({} as UserSettings).notNull(),
    // Unix timestamp (seconds). Sessions with iat < this value are rejected.
    // Allows per-user session invalidation without rotating SESSION_SECRET.
    invalidate_sessions_before: bigint('invalidate_sessions_before', { mode: 'number' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    last_login_at: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => [index('users_email_idx').on(t.email)],
);

// ---------- LOGIN ATTEMPTS (rate limiting) ----------

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ip_hash: text('ip_hash').notNull(),
    attempted_at: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
    success: boolean('success').default(false).notNull(),
  },
  (t) => [index('login_attempts_ip_idx').on(t.ip_hash, t.attempted_at)],
);

// ---------- PASSWORD RESET TOKENS ----------

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    token_hash: text('token_hash').notNull().unique(),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    used_at: timestamp('used_at', { withTimezone: true }),
  },
  (t) => [
    index('prt_user_idx').on(t.user_id),
    index('prt_token_idx').on(t.token_hash),
  ],
);

// ---------- AUDIT LOG ----------

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(), // 'create' | 'update' | 'delete' | 'login' | 'logout'
    entity_type: text('entity_type'),
    entity_id: uuid('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('audit_log_user_idx').on(t.user_id, t.created_at),
    index('audit_log_entity_idx').on(t.entity_type, t.entity_id),
  ],
);

// ---------- UNIVERSIDAD ----------

export const subjects = pgTable('subjects', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  semester: text('semester').notNull(),
  schedule: jsonb('schedule').$type<ScheduleSlot[]>().default([]).notNull(),
  active: boolean('active').default(true).notNull(),
  vault_slug: text('vault_slug'),
  is_sample: boolean('is_sample').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    subject_id: uuid('subject_id').references(() => subjects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    due_date: date('due_date'),
    status: text('status').$type<AssignmentStatus>().default('todo').notNull(),
    resources: jsonb('resources').$type<Array<{ name: string; url: string; type?: string }>>().default([]).notNull(),
    is_sample: boolean('is_sample').default(false).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('assignments_user_status_idx').on(t.user_id, t.status),
    index('assignments_user_due_idx').on(t.user_id, t.due_date),
    index('assignments_subject_idx').on(t.subject_id),
  ],
);

// ---------- TRABAJO ----------

export const workblocks = pgTable(
  'workblocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<WorkblockType>().default('task').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').$type<WorkblockStatus>().default('backlog').notNull(),
    priority: text('priority').$type<WorkblockPriority>().default('med').notNull(),
    due_date: date('due_date'),
    client: text('client').default('').notNull(),
    notes: text('notes'),
    links: jsonb('links').$type<Record<string, string>>().default({}).notNull(),
    position: integer('position').default(0).notNull(),
    is_sample: boolean('is_sample').default(false).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('workblocks_user_status_idx').on(t.user_id, t.status),
    index('workblocks_user_position_idx').on(t.user_id, t.status, t.position),
  ],
);

// ---------- BUILD-IN-PUBLIC ----------

export const buildItems = pgTable(
  'build_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
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
    is_sample: boolean('is_sample').default(false).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('build_items_user_status_idx').on(t.user_id, t.status),
    index('build_items_user_published_idx').on(t.user_id, t.published_at),
  ],
);

// ---------- EXPORT TRACKING ----------

export const vaultExports = pgTable('vault_exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
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
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon'),
    description: text('description'),
    status: text('status').$type<FreelanceClientStatus>().default('active').notNull(),
    stack: text('stack'),
    next_step: text('next_step'),
    last_update: text('last_update'),
    links: jsonb('links').$type<Record<string, string>>().default({}).notNull(),
    is_sample: boolean('is_sample').default(false).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('freelance_clients_user_status_idx').on(t.user_id, t.status)],
);

export const freelanceTasks = pgTable(
  'freelance_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    client_id: uuid('client_id').references(() => freelanceClients.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').$type<FreelanceTaskStatus>().default('backlog').notNull(),
    priority: text('priority').$type<WorkblockPriority>().default('med').notNull(),
    due_date: date('due_date'),
    is_sample: boolean('is_sample').default(false).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('freelance_tasks_user_status_idx').on(t.user_id, t.status),
    index('freelance_tasks_client_idx').on(t.client_id),
  ],
);

// ---------- PROYECTOS PROPIOS ----------

export const ownProjects = pgTable(
  'own_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon'),
    description: text('description'),
    status: text('status').$type<ProjectStatus>().default('active').notNull(),
    last_update: text('last_update'),
    next_step: text('next_step'),
    links: jsonb('links').$type<Record<string, string>>().default({}).notNull(),
    is_sample: boolean('is_sample').default(false).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('own_projects_user_status_idx').on(t.user_id, t.status)],
);

// ---------- ORGANIZACIONES ----------

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    is_sample: boolean('is_sample').default(false).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('organizations_user_idx').on(t.user_id)],
);

// ---------- COMUNIDAD ----------

export const communityItems = pgTable(
  'community_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    organization_id: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').$type<CommunityStatus>().default('pending').notNull(),
    due_date: date('due_date'),
    is_sample: boolean('is_sample').default(false).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('community_items_user_status_idx').on(t.user_id, t.status)],
);

// ---------- API TOKENS ----------

export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    token_hash: text('token_hash').notNull().unique(),
    token_prefix: text('token_prefix').notNull(),
    scopes: jsonb('scopes').$type<ApiScope[]>().notNull().default([]),
    last_used_at: timestamp('last_used_at', { withTimezone: true }),
    expires_at: timestamp('expires_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revoked_at: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    index('api_tokens_user_id_idx').on(t.user_id),
    index('api_tokens_token_hash_idx').on(t.token_hash),
  ],
);

// ---------- API RATE LIMITING ----------

// One row per request to a rate-limited API v1 route. Mirrors the login_attempts
// pattern: a sliding-window count over recent rows, with old rows opportunistically
// cleaned up. See lib/rate-limits.ts for the tunable window/threshold and
// lib/api-rate-limit.ts for the enforcement logic.
export const apiRateLimitHits = pgTable(
  'api_rate_limit_hits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token_id: uuid('token_id').notNull().references(() => apiTokens.id, { onDelete: 'cascade' }),
    route: text('route').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('api_rate_limit_hits_token_idx').on(t.token_id, t.created_at)],
);

// ---------- OAUTH ACCOUNTS ----------

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').$type<OAuthProvider>().notNull(),
    provider_account_id: text('provider_account_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('oauth_accounts_user_id_idx').on(t.user_id),
    uniqueIndex('oauth_accounts_provider_account_idx').on(t.provider, t.provider_account_id),
  ],
);

// ---------- TYPES ----------

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
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
export type OrganizationRow = typeof organizations.$inferSelect;
export type OrganizationInsert = typeof organizations.$inferInsert;
export type CommunityItemRow = typeof communityItems.$inferSelect;
export type CommunityItemInsert = typeof communityItems.$inferInsert;
export type ApiTokenRow = typeof apiTokens.$inferSelect;
export type ApiTokenInsert = typeof apiTokens.$inferInsert;
export type OAuthAccountRow = typeof oauthAccounts.$inferSelect;
export type OAuthAccountInsert = typeof oauthAccounts.$inferInsert;
