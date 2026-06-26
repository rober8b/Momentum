// Plan limit enforcement.
//
// Self-hosted installs (MOMENTUM_MODE !== 'hosted') are always unlimited — this
// is the open-core guarantee. Limits only apply when MOMENTUM_MODE === 'hosted'.

import 'server-only';
import { count, eq, and, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { PLAN_LIMITS, type LimitedResource } from '@/lib/plans';
import type { UserPlan } from '@/lib/types';

export type { LimitedResource } from '@/lib/plans';

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

async function countTotalLeafItems(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.pillarItems)
    .innerJoin(schema.pillars, eq(schema.pillars.id, schema.pillarItems.pillar_id))
    .where(and(
      eq(schema.pillars.user_id, userId),
      eq(schema.pillarItems.is_container, false),
    ));
  return Number(row?.value ?? 0);
}

/**
 * Check whether `userId` can create one more item of the given resource type.
 * - `leaf_items`: total is_container=false items across ALL pillars vs FREE_LEAF_ITEM_LIMIT.
 * - `api_tokens`: non-revoked tokens vs the plan's token cap.
 * Always returns allowed:true (unlimited) in self-host mode or on the 'pro' plan.
 */
export async function checkLimit(userId: string, resource: LimitedResource): Promise<LimitCheck> {
  if (process.env.MOMENTUM_MODE !== 'hosted') return UNLIMITED_CHECK;

  const [user] = await db.select({ plan: schema.users.plan }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const plan = user?.plan ?? 'free';
  const limit = PLAN_LIMITS[plan][resource];
  if (limit === null) return UNLIMITED_CHECK;

  let current: number;
  if (resource === 'leaf_items') {
    current = await countTotalLeafItems(userId);
  } else {
    // api_tokens — revoked tokens don't count (they're effectively deleted).
    const [row] = await db
      .select({ value: count() })
      .from(schema.apiTokens)
      .where(and(eq(schema.apiTokens.user_id, userId), isNull(schema.apiTokens.revoked_at)));
    current = Number(row?.value ?? 0);
  }

  return { allowed: current < limit, current, limit };
}

/** True when running in hosted mode, where plan limits are enforced. */
export function isHostedMode(): boolean {
  return process.env.MOMENTUM_MODE === 'hosted';
}

export type UsageSummary = {
  leafItems: LimitCheck;
  apiTokens: LimitCheck;
};

/** Current usage vs. plan limit for both tracked resources — for the settings/plan UI. */
export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const [leafItems, apiTokens] = await Promise.all([
    checkLimit(userId, 'leaf_items'),
    checkLimit(userId, 'api_tokens'),
  ]);
  return { leafItems, apiTokens };
}
