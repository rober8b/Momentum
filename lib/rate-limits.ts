// Per-token rate limits for API v1 import endpoints.
// To adjust a limit, change the numbers here — nothing else needs to change.
//
// Hosted (multi-tenant, MOMENTUM_MODE=hosted): stricter. The DB is shared across
// tenants, and a leaked token or scripting bug from one user shouldn't degrade
// the service for everyone else.
//
// Self-hosted (default, single trusted user, own infra): looser. There's no
// multi-tenant blast radius — the only realistic risk is your own script
// looping and hammering your own Postgres. We still rate-limit by default
// (cheap insurance against that), but self-hosters who find it gets in the
// way of a legitimate bulk-import session can raise `self_hosted.maxRequests`
// here, or set it very high to effectively disable it.

export type RateLimitConfig = { windowMinutes: number; maxRequests: number };

export const API_IMPORT_RATE_LIMIT: { hosted: RateLimitConfig; self_hosted: RateLimitConfig } = {
  hosted: { windowMinutes: 1, maxRequests: 10 },
  self_hosted: { windowMinutes: 1, maxRequests: 60 },
};
