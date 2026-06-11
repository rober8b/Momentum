// Single source of truth for plan tier limits.
// To adjust a limit, change the number here — nothing else needs to change.
// `null` means unlimited.

import type { UserPlan } from '@/lib/types';

export type LimitedResource =
  | 'assignments'
  | 'workblocks'
  | 'build_items'
  | 'freelance_clients'
  | 'freelance_tasks'
  | 'own_projects'
  | 'organizations'
  | 'community_items'
  | 'api_tokens';

export type PlanLimits = Record<LimitedResource, number | null>;

export const PLAN_LIMITS: Record<UserPlan, PlanLimits> = {
  free: {
    assignments: 50, // uni: TPs/assignments across all subjects
    workblocks: 50, // work: tickets/tasks in the kanban
    build_items: 50, // build: posts/projects in build-in-public pipeline
    freelance_clients: 3, // freelance: active+inactive clients
    freelance_tasks: 50, // freelance: tasks across all clients
    own_projects: 5, // side projects
    organizations: 3, // community organizations
    community_items: 50, // community: commitments/items
    api_tokens: 1, // API tokens for MCP/external integration
  },
  pro: {
    assignments: null,
    workblocks: null,
    build_items: null,
    freelance_clients: null,
    freelance_tasks: null,
    own_projects: null,
    organizations: null,
    community_items: null,
    api_tokens: null,
  },
};
