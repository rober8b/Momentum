// Shared types — espejo del schema de Supabase (supabase/schema.sql)
// Mantener sincronizado a mano hasta que se autogenerre con supabase gen types.

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

export type Assignment = {
  id: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: AssignmentStatus;
  created_at: string;
  completed_at: string | null;
};

// ---------- WORK (Aleph) ----------

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
  description: string | null;
  status: ProjectStatus;
  last_update: string | null;
  next_step: string | null;
  links: Record<string, string>;
  created_at: string;
  updated_at: string;
};

// ---------- COMUNIDAD ----------

export type CommunityOrg = 'ai-consensus' | 'levellers' | 'xplora' | 'other';
export type CommunityStatus = 'pending' | 'done' | 'cancelled';

export type CommunityItem = {
  id: string;
  organization: CommunityOrg;
  title: string;
  description: string | null;
  status: CommunityStatus;
  due_date: string | null;
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
