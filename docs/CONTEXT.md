# Momentum — Context

Momentum is a self-hosted personal productivity dashboard. It's an operational layer for daily
work, sitting above a long-term knowledge base (an Obsidian vault), with a weekly export of
completed items back into that vault.

## Pillars

The app is organized around 7 pillars:

1. **Today** — daily aggregator across all pillars (kanban-style "what's on deck")
2. **Uni** — university coursework (subjects, assignments)
3. **Work** — workblocks/tickets, kanban board
4. **Freelance** — clients and tasks per client
5. **Projects** — own side projects
6. **Community** — organizations and commitments
7. **Build-in-public** — content pipeline (ideas → drafts → scheduled → published)

## Stack

- **Framework:** Next.js 16 + React 19, App Router, TypeScript (strict)
- **Styling:** Tailwind CSS v4 (`@theme inline` in `app/globals.css`, no `tailwind.config.js`)
- **DB:** Postgres (Railway), via Drizzle ORM (`postgres-js` driver)
- **Auth:** bcrypt + HMAC-signed cookies, multi-user (`users` table, `admin`/`member` roles) — no
  external auth provider
- **i18n:** `lib/strings.ts` + `t(key, lang)`, `en`/`es`
- **API:** `/api/v1/*` — Bearer-token REST API (scoped tokens) for MCP/external integrations
- **Deploy:** Vercel + Vercel Cron

## Direction

Momentum is moving toward an **open-core freemium SaaS** model: the codebase stays open and fully
self-hostable for free, while a hosted version is offered as a paid convenience product. See
[`SAAS_ROADMAP.md`](./SAAS_ROADMAP.md) for the detailed plan.

---

*This is a living document — update it as the project evolves.*
