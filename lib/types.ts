// Shared types — mirrors the Drizzle schema in lib/db/schema.ts.

// ---------- USERS ----------

export type UserRole = 'admin' | 'member';

export type UserPlan = 'free' | 'pro';
export type UserPlanStatus = 'active' | 'past_due' | 'cancelled';

export type UserSettings = {
  timezone: string;
  language: 'en' | 'es';
  theme: 'dark' | 'light';
  export_enabled: boolean;
  vault_path: string;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  timezone: 'UTC',
  language: 'en',
  theme: 'dark',
  export_enabled: false,
  vault_path: '',
};

export type User = {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  active: boolean;
  plan: UserPlan;
  plan_status: UserPlanStatus;
  settings: UserSettings;
  invalidate_sessions_before: number | null;
  created_at: string;
  last_login_at: string | null;
};

// ---------- UNIVERSIDAD ----------

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type ScheduleSlot = {
  day: DayOfWeek;
  start: string;  // 'HH:mm'
  end: string;    // 'HH:mm'
  room?: string;
};

export type Subject = {
  id: string;
  name: string;
  semester: string;
  schedule: ScheduleSlot[];
  active: boolean;
  vault_slug: string | null;
  created_at: string;
};

export type AssignmentStatus = 'todo' | 'in-progress' | 'done';

export type AssignmentResource = {
  name: string;
  url: string;
  type?: string;
};

export type Assignment = {
  id: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: AssignmentStatus;
  resources: AssignmentResource[];
  created_at: string;
  completed_at: string | null;
};

// ---------- WORK ----------

export type WorkblockType = 'ticket' | 'task' | 'meeting' | 'review';
export type WorkblockStatus = 'backlog' | 'today' | 'in-progress' | 'blocked' | 'done';
export type WorkblockPriority = 'low' | 'med' | 'high';

export type Workblock = {
  id: string;
  type: WorkblockType;
  title: string;
  description: string | null;
  status: WorkblockStatus;
  priority: WorkblockPriority;
  due_date: string | null;
  client: string;
  notes: string | null;
  links: Record<string, string>;
  position: number;
  created_at: string;
  completed_at: string | null;
};

// ---------- BUILD-IN-PUBLIC ----------

export type BuildType =
  | 'hackathon'
  | 'project'
  | 'opinion'
  | 'news'
  | 'portfolio-update'
  | 'open-source'
  | 'demo';

export type BuildStatus = 'idea' | 'draft' | 'scheduled' | 'published' | 'discarded';

export type BuildItem = {
  id: string;
  type: BuildType;
  title: string;
  draft: string | null;
  hook: string | null;
  platforms: string[];
  status: BuildStatus;
  scheduled_for: string | null;
  published_at: string | null;
  links: Record<string, string>;
  metrics: Record<string, number>;
  related_project: string | null;
  created_at: string;
};

// ---------- FREELANCE ----------

export type FreelanceClientStatus = 'active' | 'paused' | 'blocked' | 'archived';

export type FreelanceClient = {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  status: FreelanceClientStatus;
  stack: string | null;
  next_step: string | null;
  last_update: string | null;
  links: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type FreelanceTaskStatus = 'backlog' | 'today' | 'in-progress' | 'blocked' | 'done';

export type FreelanceTask = {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: FreelanceTaskStatus;
  priority: WorkblockPriority;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
};

// ---------- PROYECTOS PROPIOS ----------

export type ProjectStatus = 'active' | 'paused' | 'blocked' | 'archived';

export type OwnProject = {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  status: ProjectStatus;
  last_update: string | null;
  next_step: string | null;
  links: Record<string, string>;
  created_at: string;
  updated_at: string;
};

// ---------- COMUNIDAD ----------

export type CommunityStatus = 'pending' | 'done' | 'cancelled';

export type Organization = {
  id: string;
  user_id: string | null;
  name: string;
  slug: string;
  created_at: string;
};

export type CommunityItem = {
  id: string;
  organization_id: string | null;
  organization_name: string | null;
  title: string;
  description: string | null;
  status: CommunityStatus;
  due_date: string | null;
  created_at: string;
};

// ---------- API TOKENS ----------

export type ApiScope =
  | 'projects:write'
  | 'uni:write'
  | 'work:write'
  | 'community:write'
  | 'freelance:write'
  | 'build:write'
  | 'organizations:write';

export const ALL_SCOPES: ApiScope[] = [
  'projects:write',
  'uni:write',
  'work:write',
  'community:write',
  'freelance:write',
  'build:write',
  'organizations:write',
];

export type ApiToken = {
  id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  scopes: ApiScope[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

// ---------- OAUTH ----------

export type OAuthProvider = 'github' | 'google';

export type OAuthAccount = {
  id: string;
  user_id: string;
  provider: OAuthProvider;
  provider_account_id: string;
  created_at: string;
};

// ---------- EXPORT ----------

export type VaultExport = {
  id: string;
  exported_at: string;
  item_count: number;
  items: Array<{ type: string; id: string; title: string }>;
  status: 'success' | 'failure' | 'partial';
  error: string | null;
};
