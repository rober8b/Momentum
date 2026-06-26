// Single source of truth for plan tier limits.
// To adjust a limit, change the number here — nothing else needs to change.
// `null` means unlimited.

import type { UserPlan } from '@/lib/types';

/** Max leaf items (pillar_items where is_container = false) across ALL pillars, free plan. */
export const FREE_LEAF_ITEM_LIMIT = 150;

export type LimitedResource = 'leaf_items' | 'api_tokens';

export type PlanLimits = Record<LimitedResource, number | null>;

export const PLAN_LIMITS: Record<UserPlan, PlanLimits> = {
  free: {
    leaf_items: FREE_LEAF_ITEM_LIMIT,
    api_tokens: 1,
  },
  pro: {
    leaf_items: null,
    api_tokens: null,
  },
};
