# momentum

**The organization platform for builders.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/rober8b/Momentum&env=DATABASE_URL,SESSION_SECRET&envDescription=See%20.env.example%20for%20all%20required%20variables)

---

## Screenshots

| Today view | Work kanban | Uni & assignments |
|------------|-------------|-------------------|
| ![Today view](docs/screenshots/today.png) | ![Kanban](docs/screenshots/kanban.png) | ![Uni](docs/screenshots/uni.png) |

> Screenshots coming soon. Self-host and see for yourself.

---

## What is this?

Momentum is a personal dashboard with 7 pillars: **Today**, **Uni**, **Work**, **Freelance**, **Projects**, **Community**, and **Build-in-public**. It aggregates your daily context into one view — what classes you have today, what tickets are in progress, which freelance clients need attention, and what build ideas are queued.

It is designed to be self-hosted. There is no cloud service, no subscription, no vendor lock-in. You own your data — it lives in a Postgres database you control. Deploy takes about 15 minutes with Vercel + Railway.

---

## Features

- **Today** — Daily operating view aggregating items from all pillars: classes, assignments due soon, active workblocks, build queue, and community commitments.
- **Uni** — Subject management with weekly schedule grid, assignment tracking, due-date urgency badges, and optional notes/vault path.
- **Work** — Kanban board with 5 columns (backlog → today → in-progress → blocked → done), priority ordering, and optional client tagging.
- **Freelance** — Client roster with per-client task lists, status tracking, stack notes, next steps, and GitHub last-push integration.
- **Projects** — Own side projects tracked independently from client work — status, links, last update.
- **Community** — Commitments and events organized by organization, with due-date urgency and done/cancelled tracking.
- **Build** — Build-in-public pipeline: ideas → drafts → published. Hook + body editor with platform targeting (X, LinkedIn).
- **Multi-user** — Row-level data isolation by `user_id`. First user becomes admin via setup wizard.
- **Weekly export** — Completed items serialized to Markdown and downloadable for import into any note-taking system.
- **Auth** — Password + HMAC-signed cookie. No external auth services. Optional email verification via Resend.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 + React 19 (App Router, Server Components) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| UI primitives | `@base-ui/react` + custom components |
| Animations | `motion` v12 |
| Database | PostgreSQL 14+ |
| ORM | Drizzle ORM (type-safe, schema-driven) |
| Auth | HMAC-signed cookie (node:crypto, no external service) |
| Email | Resend (optional; log-mode without API key) |
| Deploy | Vercel (serverless) + Railway (managed Postgres) |

---

## Quick start (self-host)

### Prerequisites

- Node.js 20+
- A PostgreSQL 14+ database ([Railway](https://railway.app) recommended — free tier available)
- A [Vercel](https://vercel.com) account for deployment

### 1. Clone the repo

```bash
git clone https://github.com/rober8b/Momentum.git
cd Momentum
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up the database

Provision a Postgres database on [Railway](https://railway.app):

1. New Project → **Provision PostgreSQL**
2. Open the service → **Settings** → **Variables** → copy `DATABASE_URL`

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in at minimum:

```env
DATABASE_URL=postgres://...        # from Railway
SESSION_SECRET=<32-char hex>       # openssl rand -hex 32
```

See [`.env.example`](.env.example) for all variables with descriptions.

### 5. Run migrations

```bash
npx drizzle-kit push
```

### 6. (Optional) Seed demo data

```bash
npm run db:seed:demo
# Creates demo@example.com / demo1234 with sample data across all pillars
```

### 7. Run locally

```bash
npm run dev
# → http://localhost:3000
```

On first run with no users, you'll be redirected to `/setup` to create the admin account.

### 8. Deploy to Vercel

Click the button at the top of this README, or:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set the same env vars in **Vercel → Project → Settings → Environment Variables**.

---

## Deployment

### One-click Vercel deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/rober8b/Momentum&env=DATABASE_URL,SESSION_SECRET&envDescription=See%20.env.example%20for%20all%20required%20variables)

### Database (Railway)

1. [railway.app](https://railway.app) → New Project → Provision PostgreSQL
2. Enable the **Public Network** in Settings → Networking (needed for Vercel to connect)
3. Copy `DATABASE_URL` from Settings → Variables

### First-run setup

After deploying, visit `https://your-app.vercel.app/setup`. This creates the first admin account. `/setup` is only accessible when no users exist in the database.

### Weekly export cron

The export cron is configured in `vercel.json` (Sundays 22:00 UTC). Set `CRON_SECRET` in Vercel env vars to protect the `/api/export` endpoint.

---

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | 32+ char secret for signing session cookies |
| `NEXT_PUBLIC_SITE_URL` | optional | Base URL for email links (default: `http://localhost:3000`) |
| `ALLOW_SIGNUP` | optional | Enable `/signup` page (default: `false`) |
| `REQUIRE_EMAIL_CONFIRMATION` | optional | Require email verification (default: `false`) |
| `RESEND_API_KEY` | optional* | Resend API key for transactional email |
| `EMAIL_FROM` | optional* | From address (must be on a verified Resend domain) |
| `CRON_SECRET` | optional | Bearer token for Vercel cron auth |
| `GITHUB_TOKEN` | optional | PAT for GitHub last-push integration |

*Required when `REQUIRE_EMAIL_CONFIRMATION=true`.

Without `RESEND_API_KEY`, email content is logged to the server console (useful for local dev).

---

## Architecture

**Server Components + Server Actions.** All data fetching happens in React Server Components (`page.tsx` files). Mutations go through Next.js Server Actions (`actions.ts` files) — no API routes for app data (exception: `/api/export` for the Vercel cron). This keeps the client bundle small and avoids a separate API layer.

**Drizzle ORM with a singleton client.** The Postgres connection is a singleton in `lib/db/index.ts`, which prevents connection storms during Next.js hot reloads in development. Schema is the single source of truth in `lib/db/schema.ts` — types in `lib/types.ts` mirror it.

**HMAC cookie auth with no external dependencies.** Sessions are signed cookies (`momentum_session`) using `node:crypto` HMAC-SHA256. The session token contains the user ID and issued-at timestamp. The Edge-compatible `proxy.ts` (Next.js 16's `middleware.ts` replacement) verifies the cookie on every request using Web Crypto. Server Components and Actions call `requireUser()` for a second verification. Per-user session invalidation is supported via `invalidate_sessions_before` in the users table.

**Multi-user with row-level filtering.** Every table has a `user_id` foreign key. All queries filter by `eq(schema.X.user_id, user.id)`. There is no shared data between users. The first user registered gets the `admin` role; subsequent users get `member`.

**Weekly Markdown export.** `lib/vault-export.ts` serializes completed items from the past week into Markdown files with YAML frontmatter. The output can be imported into any Markdown-based note system (Obsidian, Logseq, etc.). The export is triggered by a Vercel cron job or manually from the sidebar.

---

## Roadmap

- [ ] 2FA (TOTP)
- [ ] OAuth (Google, GitHub)
- [ ] Mobile app (React Native)
- [ ] Public API (REST + OpenAPI spec)
- [ ] Webhooks for external integrations

---

## Contributing

Issues and PRs are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening one.

---

## Security

Found a vulnerability? Please **do not open a public issue**. See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

---

## License

MIT — see [LICENSE](LICENSE).

---

## Acknowledgments

Built with Next.js, Drizzle ORM, Tailwind CSS, and a deep appreciation for tools that stay out of your way.
