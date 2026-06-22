# Dynamic Pillars — design doc

Status: **approved, Phase 0 in progress (Sprint B)**. This is the design from the Sprint A proposal,
with the decisions the user locked in before implementation started. Treat this file as the source of
truth for the dynamic pillar engine across sessions — update it when a locked decision changes, don't
let the design live only in chat history.

## Why

Momentum has 7 hardcoded pillars (Today, Uni, Work, Freelance, Projects, Community, Build), each with its
own table, page, and server actions. The goal is to make pillars **dynamic** — defined by data, per user —
so a future generative onboarding can infer a user's own structure (an engineering student gets different
pillars than a freelance designer) and a user can reconfigure conversationally later ("add a Health
pillar", "merge these projects"). The 7 current pillars become **predefined templates** instantiated on
the same dynamic engine, not fixed code. Nothing is imposed — a user can keep, modify, delete, or ignore
any of them.

## Locked decisions

These are decided. Don't re-litigate them without a new explicit conversation — if one changes, update
this doc.

1. **Two core tables:** `pillars` (per-user pillar definition) and `pillar_items` (the generic item).
2. **Hybrid field storage.** Typed columns for the fields every pillar already sorts/filters on (`status`,
   `due_date`, `completed_at`, `position`). Everything pillar-specific (priority, platforms, metrics,
   stack, links, schedule) lives in a `fields` jsonb column. `priority`/`rank` stays in `fields` — no
   dedicated column, at least for now.
3. **Hierarchy via self-reference + explicit discriminator.** `parent_item_id` (nullable, self-referencing
   FK on `pillar_items`) handles Uni's subject→assignment and Freelance's client→task identically. An
   explicit `is_container: boolean` column marks parent-type rows — **the renderer never infers
   "this is a group" by checking whether anything points at it; a container declares itself.**
4. **Status validation moves to the app layer.** `status` is a free-text column, validated with Zod against
   the owning pillar's `status_workflow` at write time. This is a deliberate loss of the DB-enum safety
   net that the old per-pillar tables had — accepted as the cost of genuine dynamism.
5. **Three generic view types: `list`, `kanban`, `grid`.** Exotic views (Uni's weekly schedule grid,
   Freelance's GitHub-last-push badge) are `'custom'` renderers, registered in code, explicitly out of
   scope for the generic engine. Don't generalize these — that's the over-engineering trap.
6. **Templates are code, not a DB table.** The 7 current pillars are static config (see
   `lib/pillar-templates.ts`) — product config that changes via code review, not user data. Instantiating
   a template means inserting one `pillars` row copied from it (`source_template` set for traceability).
   Copy-not-reference means a user's pillar is immediately independent of the template.
7. **Free-plan limit will be total items across all pillars, not per-pillar.** Not implemented this
   sprint — `lib/plans.ts` still has the old per-resource-table limits. Flagging so nobody re-derives this
   from scratch later: when dynamic pillars replace the old tables, the limit model changes shape too.

## Data model

```
pillars
  id              uuid pk
  user_id         uuid fk -> users, cascade delete
  key             text            -- stable slug, e.g. "projects" — unique per user, not globally
  name            text
  icon            text | null
  description     text | null
  position        integer         -- nav ordering
  view_type       text            -- 'list' | 'kanban' | 'grid' | 'custom'
  status_workflow jsonb           -- [{ key, label, color?, is_terminal? }, ...]
  config          jsonb           -- view-type-specific settings, see below
  source_template text | null     -- which template this was instantiated from, if any
  is_archived     boolean
  created_at, updated_at

pillar_items
  id              uuid pk
  user_id         uuid fk -> users, cascade delete       -- denormalized for simple scoping/indexing
  pillar_id       uuid fk -> pillars, cascade delete
  parent_item_id  uuid fk -> pillar_items.id, cascade delete, nullable, self-referencing
  is_container    boolean         -- explicit: "this item can have children" (e.g. a client, a subject)
  title           text
  description     text | null
  status          text            -- validated against pillars.status_workflow at the app layer
  due_date        date | null
  completed_at    timestamptz | null
  position        integer
  is_sample       boolean
  fields          jsonb           -- pillar-specific: priority, platforms, links, metrics, stack, schedule...
  created_at, updated_at
```

`config` shape per view type (informal, not DB-enforced):

```ts
kanban: { columns: [{ key, label, color? }], statusField: 'status' }
list:   { sortField, groupByField? }   // groupByField: 'parent_item_id' covers Community-style grouping
grid:   { cardFields: string[] }       // which fields to surface on the card
custom: { renderer: string }           // e.g. 'uni-schedule' — looked up in a code registry, not generalized
```

## Migration strategy (for when we cut real pillars over — not this sprint)

Sprint B does **not** migrate any existing data. This section documents the plan for when that happens,
so it's written down before it's needed, not improvised under pressure.

- **Additive first, destructive never in the same step.** New tables coexist with the old per-pillar
  tables for a real bake period. Old tables are dropped only in a final, separate, deliberate cleanup
  migration — not as part of any cutover.
- **The data transform is an app-level script**, not a raw SQL migration — mapping `title`/`name`,
  `completed_at`/`published_at`/`scheduled_for`, resolving two different hierarchies, and carrying
  `is_sample` correctly is real business logic, reviewed like any other code change.
- **Idempotent and re-runnable.** Migrated rows carry a `legacy_table` + `legacy_id` pair (unique indexed)
  so re-running after a bugfix upserts instead of duplicating.
- **Test against local Docker first, always**, using the existing `db:seed:demo` data as the realistic
  testbed, before ever touching Railway.
- **Manual, supervised cutover — not automatic on deploy.** Unlike a schema migration (which is safe to
  auto-run via `vercel-build`), a *data* transform script failing partway through is messier to recover
  from mid-deploy, and this touches real hosted/Polar-paying users. Each pillar's cutover is a deliberate,
  watched step, not a side effect of `git push`.
- **Rollback is a flag, not a revert.** While both schemas coexist, a flag decides which code path reads —
  flipping it back is the rollback, no data is destroyed by flipping it.
- **Verify with round-trip diffs, not row counts.** For a sample of migrated items, re-derive the old shape
  from the new generic row and diff against the original. Catches a forgotten field or status-string
  mismatch that count-matching would miss.
- **Take a fresh, verified backup right before any destructive step** (drop-old-tables cleanup) — this is
  exactly what the Sprint 11 encrypted backup + restore drill exists for.

## Phasing (6 phases, from the Sprint A proposal)

0. **Schema only** (this sprint) — additive tables, nothing reads/writes them yet.
1. **Prove the engine on one pillar, additively** (this sprint) — Projects, alongside the untouched
   `/projects`.
2. **Cutover Projects for real** — migrate `own_projects` data, flip `/projects` to the new tables, keep
   the old table around as a safety net.
3. **Hierarchy + a second view type** — Freelance (client→task, kanban) or Build next.
4. **The hard/special ones, last** — Uni (schedule, hierarchy) and Community (optional grouping). Uni's
   schedule stays a `custom` renderer.
5. **Cross-cutting subsystems catch up** — Today aggregator, search, vault export, API v1 import, plan
   limits, sample data. Best done incrementally per-pillar alongside phases 2–4, not as one big-bang phase.
6. **Decommission** — drop old tables once all 7 are migrated and stable for real bake time.

Generative onboarding (the actual product motivation) is a thin layer built on top once templates are real
instantiable data (earliest: end of phase 2) — out of scope for this doc's phasing.

## Open questions carried over from the design review

These were flagged in the Sprint A proposal and partially resolved by the locked decisions above. Still
open:

- **jsonb has a real ceiling** at scale for sorting/filtering on `fields` keys — not urgent at current
  scale, worth revisiting if hosted usage grows.
- **Generic views will be visibly less polished than today's bespoke ones** (GitHub badge, platform icons).
  Either the generic card grows a "render extra fields by key" escape hatch, or some visual richness is
  deliberately given up. Not resolved — an ongoing cost, not a one-time migration cost.
- **GitHub last-push and similar integrations stay a convention** (`fields.links.repo`), not
  infrastructure — cheapest option, a deliberate scope decision.
- **Plan limits need a real redesign** once dynamic pillars are real (see locked decision #7) — not
  designed yet, just decided to be "total items across pillars" in direction.
