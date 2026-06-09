# Changelog

## [0.1.0] - 2026-06-08

Initial public release.

### Core
- 7 pillars: Today, Uni, Work, Freelance, Projects, Community, Build
- Multi-user with row-level isolation
- HMAC-SHA256 cookie auth with bcrypt password hashing
- Setup wizard for first admin (UI + REST endpoint)
- Optional signup with rate limiting, honeypot, blocklist, email confirmation
- Password reset with email tokens
- Audit log of all mutations
- Per-user timezone and language (en/es)
- Empty states across all pillars
- Search across all data

### API
- REST API v1 at /api/v1/*
- API tokens with scoped permissions at /settings/api-tokens
- Endpoints: health, setup, setup-status, login, tokens,
  import/{projects,assignments,workblocks,community,freelance,build}

### Security
- Content-Security-Policy headers
- Strict-Transport-Security (HSTS)
- X-Frame-Options DENY
- Per-user session invalidation via invalidate_sessions_before
- Login attempts tracked in DB with rate limiting

### Infrastructure
- Vercel deployment ready
- Railway PostgreSQL ready
- Weekly cron export to markdown for Obsidian
- Optional Resend integration for transactional email
- CI workflow (typecheck + build on PR)

### Companion MCP server
- github.com/rober8b/Momentum-mcp
- 6 tools for automated setup and Obsidian vault import
