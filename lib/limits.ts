// Plan limit enforcement.
//
// Self-hosted installs (MOMENTUM_MODE !== 'hosted') are always unlimited — this
// is the open-core guarantee. Limits only apply when MOMENTUM_MODE === 'hosted'.

import 'server-only';
import { count, eq, and, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { PLAN_LIMITS, type LimitedResource } from '@/lib/plans';
import {
  isProjectsDynamicEngineEnabled,
  isFreelanceDynamicEngineEnabled,
  isCommunityDynamicEngineEnabled,
  isUniDynamicEngineEnabled,
  isBuildDynamicEngineEnabled,
  isWorkDynamicEngineEnabled,
} from '@/lib/pillar-flags';
import { PROJECTS_TEMPLATE, FREELANCE_TEMPLATE, COMMUNITY_TEMPLATE, UNI_TEMPLATE, BUILD_TEMPLATE, WORK_TEMPLATE } from '@/lib/pillar-templates';
import type { UserPlan } from '@/lib/types';

export type { LimitedResource } from '@/lib/plans';

const ALL_LIMITED_RESOURCES: LimitedResource[] = [
  'assignments',
  'workblocks',
  'build_items',
  'freelance_clients',
  'freelance_tasks',
  'own_projects',
  'organizations',
  'community_items',
  'api_tokens',
];

export type LimitCheck = {
  allowed: boolean;
  current: number;
  limit: number | null;
};

/** Structured error returned by create actions when a plan limit is reached. */
export type LimitReachedError = {
  error: 'limit_reached';
  resource: LimitedResource;
  limit: number;
};

const UNLIMITED_CHECK: LimitCheck = { allowed: true, current: 0, limit: null };

// Phase 5b: for a cut-over pillar, new items live in pillar_items, not the
// legacy table — counting the legacy table only would undercount (or, once
// a pillar's legacy table stops getting writes entirely, count zero).
async function countPillarItems(userId: string, pillarKey: string, isContainer: boolean): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.pillarItems)
    .innerJoin(schema.pillars, eq(schema.pillars.id, schema.pillarItems.pillar_id))
    .where(and(
      eq(schema.pillars.user_id, userId),
      eq(schema.pillars.key, pillarKey),
      eq(schema.pillarItems.is_container, isContainer),
    ));
  return Number(row?.value ?? 0);
}

async function countResource(userId: string, resource: LimitedResource): Promise<number> {
  switch (resource) {
    case 'assignments': {
      if (isUniDynamicEngineEnabled()) return countPillarItems(userId, UNI_TEMPLATE.key, false);
      const [row] = await db.select({ value: count() }).from(schema.assignments).where(eq(schema.assignments.user_id, userId));
      return Number(row?.value ?? 0);
    }
    case 'workblocks': {
      if (isWorkDynamicEngineEnabled()) return countPillarItems(userId, WORK_TEMPLATE.key, false);
      const [row] = await db.select({ value: count() }).from(schema.workblocks).where(eq(schema.workblocks.user_id, userId));
      return Number(row?.value ?? 0);
    }
    case 'build_items': {
      if (isBuildDynamicEngineEnabled()) return countPillarItems(userId, BUILD_TEMPLATE.key, false);
      const [row] = await db.select({ value: count() }).from(schema.buildItems).where(eq(schema.buildItems.user_id, userId));
      return Number(row?.value ?? 0);
    }
    case 'freelance_clients': {
      if (isFreelanceDynamicEngineEnabled()) return countPillarItems(userId, FREELANCE_TEMPLATE.key, true);
      const [row] = await db.select({ value: count() }).from(schema.freelanceClients).where(eq(schema.freelanceClients.user_id, userId));
      return Number(row?.value ?? 0);
    }
    case 'freelance_tasks': {
      if (isFreelanceDynamicEngineEnabled()) return countPillarItems(userId, FREELANCE_TEMPLATE.key, false);
      const [row] = await db.select({ value: count() }).from(schema.freelanceTasks).where(eq(schema.freelanceTasks.user_id, userId));
      return Number(row?.value ?? 0);
    }
    case 'own_projects': {
      if (isProjectsDynamicEngineEnabled()) return countPillarItems(userId, PROJECTS_TEMPLATE.key, false);
      const [row] = await db.select({ value: count() }).from(schema.ownProjects).where(eq(schema.ownProjects.user_id, userId));
      return Number(row?.value ?? 0);
    }
    case 'organizations': {
      if (isCommunityDynamicEngineEnabled()) return countPillarItems(userId, COMMUNITY_TEMPLATE.key, true);
      const [row] = await db.select({ value: count() }).from(schema.organizations).where(eq(schema.organizations.user_id, userId));
      return Number(row?.value ?? 0);
    }
    case 'community_items': {
      if (isCommunityDynamicEngineEnabled()) return countPillarItems(userId, COMMUNITY_TEMPLATE.key, false);
      const [row] = await db.select({ value: count() }).from(schema.communityItems).where(eq(schema.communityItems.user_id, userId));
      return Number(row?.value ?? 0);
    }
    case 'api_tokens': {
      // Revoked tokens don't count against the limit — they're effectively deleted.
      const [row] = await db
        .select({ value: count() })
        .from(schema.apiTokens)
        .where(and(eq(schema.apiTokens.user_id, userId), isNull(schema.apiTokens.revoked_at)));
      return Number(row?.value ?? 0);
    }
  }
}

/**
 * Check whether `userId` can create one more `resource`.
 * Always returns allowed:true (unlimited) in self-host mode or on the 'pro' plan.
 */
export async function checkLimit(userId: string, resource: LimitedResource): Promise<LimitCheck> {
  if (process.env.MOMENTUM_MODE !== 'hosted') return UNLIMITED_CHECK;

  const [user] = await db.select({ plan: schema.users.plan }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const plan = user?.plan ?? 'free';
  const limit = PLAN_LIMITS[plan][resource];
  if (limit === null) return UNLIMITED_CHECK;

  const current = await countResource(userId, resource);
  return { allowed: current < limit, current, limit };
}

/** True when running in hosted mode, where plan limits are enforced. */
export function isHostedMode(): boolean {
  return process.env.MOMENTUM_MODE === 'hosted';
}

export type ResourceUsage = {
  resource: LimitedResource;
  current: number;
  limit: number | null;
};

/** Current usage vs. plan limit for every limited resource — for the settings/plan UI. */
export async function getUsageSummary(userId: string, plan: UserPlan): Promise<ResourceUsage[]> {
  const limits = PLAN_LIMITS[plan];
  const counts = await Promise.all(ALL_LIMITED_RESOURCES.map((resource) => countResource(userId, resource)));
  return ALL_LIMITED_RESOURCES.map((resource, i) => ({
    resource,
    current: counts[i],
    limit: limits[resource],
  }));
}
