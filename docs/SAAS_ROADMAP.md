# Momentum — SaaS Roadmap

## Strategy: open-core freemium

Momentum stays **open-core**: the full codebase is self-hostable for free, with no feature gating
between self-hosted and hosted. The hosted offering is a paid **convenience** product.

> **You pay for not having to host, not for features.**

This means plan/limit logic should generally apply to *resource usage* (e.g. number of users,
storage, API rate limits) rather than locking pillars or core functionality behind a paywall.

## MOMENTUM_MODE flag

A `MOMENTUM_MODE` environment variable distinguishes deployment contexts:

- `self_hosted` (default) — no plans/billing enforcement, single-tenant assumptions hold
- `hosted` — multi-tenant hosted instance, plans/limits and billing are active

This flag gates which code paths (billing checks, plan limits, hosted-only onboarding flows) are
active, without requiring a separate codebase or branch.

## Sprint plan

| Sprint | Scope | Status |
|--------|-------|--------|
| **S6** | OAuth login (GitHub + Google) | ✅ done |
| **S7** | Plans & limits (data model, enforcement points) | 🔄 in progress |
| **S8** | Hosted onboarding (signup flow, tenant provisioning) | planned |
| **S9** | Stripe billing (subscriptions, webhooks) | planned |
| **S10** | Admin tooling (manage hosted users/orgs, support views) | planned |
| **S11** | Hardening & scale (perf, observability, multi-tenant safety) | planned |

---

*This is a living document — update it as sprints land or the plan changes.*
