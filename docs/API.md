# Momentum API v1

REST API for external integrations (MCP server, scripts, third-party tools).

Base URL: `https://your-momentum-instance.vercel.app/api/v1`

---

## Authentication

All endpoints (except `/health`, `/setup-status`, `/setup`, and `/login`) require a Bearer token:

```
Authorization: Bearer mmt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Generate tokens at `/settings/api-tokens` in your Momentum instance.

Tokens have a prefix of `mmt_` followed by 64 hex characters. The full token is shown **once** at creation time — store it securely (e.g., as an env var in your MCP server).

---

## Scopes

| Scope | Allows |
|-------|--------|
| `projects:write` | Create own projects |
| `uni:write` | Create subjects and assignments |
| `work:write` | Create workblocks (kanban tasks) |
| `community:write` | Create community items |
| `organizations:write` | Create organizations on-demand (required with community:write) |
| `freelance:write` | Create freelance clients and tasks |
| `build:write` | Create build-in-public items |

---

## Endpoints

### GET /api/v1/health

No auth required. Checks API and database availability.

```bash
curl https://your-instance.vercel.app/api/v1/health
```

**Response 200:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "database": "connected",
  "timestamp": "2026-06-08T18:00:00.000Z"
}
```

**Response 503** (DB down):
```json
{
  "status": "degraded",
  "version": "0.1.0",
  "database": "error",
  "timestamp": "2026-06-08T18:00:00.000Z"
}
```

---

### GET /api/v1/setup-status

No auth required. Useful for MCP setup wizards.

```bash
curl https://your-instance.vercel.app/api/v1/setup-status
```

**Response 200:**
```json
{
  "has_admin": true,
  "signup_enabled": false,
  "setup_required": false
}
```

---

### POST /api/v1/setup

No auth required. Creates the first admin user. Returns 403 if an admin already exists.

```bash
curl -X POST https://your-instance.vercel.app/api/v1/setup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "supersecret1234",
    "name": "Admin",
    "language": "en",
    "timezone": "America/Argentina/Buenos_Aires"
  }'
```

**Body:**
```ts
{
  email: string;                         // required, valid email
  password: string;                      // required, min 12 chars
  name: string;                          // required, max 100 chars
  language?: "en" | "es";               // default: "en"
  timezone?: string;                     // default: "UTC"
}
```

**Response 201:**
```json
{
  "success": true,
  "admin": {
    "id": "uuid-...",
    "email": "admin@example.com",
    "name": "Admin"
  },
  "next_step": "Generate an API token at /settings/api-tokens"
}
```

**Response 403** (already set up):
```json
{
  "error": "Setup has already been completed",
  "code": "setup_already_completed"
}
```

---

### POST /api/v1/login

No auth required. Authenticates with email/password, sets session cookie, and returns it in the body for programmatic use (e.g. MCP flows). Rate-limited: 5 failed attempts per 15 minutes per IP.

```bash
curl -X POST https://your-instance.vercel.app/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"supersecret1234"}' \
  -c cookies.txt
```

**Body:**
```ts
{
  email: string;
  password: string;
}
```

**Response 200:**
```json
{
  "success": true,
  "user": { "id": "uuid-...", "email": "admin@example.com", "name": "Admin", "role": "admin" },
  "session_cookie": "momentum_session=uuid.iat.hmac",
  "expires_at": "2026-07-08T18:00:00.000Z"
}
```

Also sets `Set-Cookie: momentum_session=...; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`.

---

### POST /api/v1/tokens

Requires a valid **session cookie** (not a Bearer token). Use after `/login` to generate an API token programmatically.

```bash
curl -X POST https://your-instance.vercel.app/api/v1/tokens \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "MCP Auto-generated Token",
    "scopes": ["projects:write","uni:write","work:write","community:write","freelance:write","build:write","organizations:write"]
  }'
```

**Body:**
```ts
{
  name: string;                          // required, max 100 chars
  scopes: ApiScope[];                    // required, min 1 scope
  expires_at?: string;                   // ISO 8601 datetime, optional
}
```

**Response 201:**
```json
{
  "token": "mmt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "id": "uuid-...",
  "prefix": "mmt_xxxxxxxx",
  "expires_at": null
}
```

The `token` value is shown **once** — store it immediately.

---

### POST /api/v1/import/projects

Requires scope: `projects:write`

```bash
curl -X POST https://your-instance.vercel.app/api/v1/import/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mmt_xxxx" \
  -d '{
    "projects": [
      {
        "name": "Momentum MCP",
        "description": "MCP server for Momentum",
        "status": "active",
        "next_step": "Deploy to npm"
      }
    ]
  }'
```

**Body:**
```ts
{
  projects: Array<{
    name: string;               // required
    description?: string;
    status?: "active" | "paused" | "blocked" | "archived";  // default: "active"
    icon?: string;
    last_update?: string;
    next_step?: string;
    links?: Record<string, string>;
  }>
}
```

**Response 200:**
```json
{
  "imported": 1,
  "ids": ["uuid-..."],
  "errors": []
}
```

---

### POST /api/v1/import/assignments

Requires scope: `uni:write`

Creates subjects on-demand if they don't exist for the user.

```bash
curl -X POST https://your-instance.vercel.app/api/v1/import/assignments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mmt_xxxx" \
  -d '{
    "assignments": [
      {
        "subject_name": "Macroeconomía",
        "title": "TP1 — Inflación Argentina",
        "due_date": "2026-06-20",
        "status": "todo"
      }
    ]
  }'
```

**Body:**
```ts
{
  assignments: Array<{
    subject_name: string;       // required — creates subject if not found
    semester?: string;          // default: current semester (e.g. "2026-1")
    title: string;              // required
    description?: string;
    due_date?: string;          // ISO date YYYY-MM-DD
    status?: "todo" | "in-progress" | "done";  // default: "todo"
    resources?: Array<{ name: string; url: string; type?: string }>;
  }>
}
```

**Response 200:**
```json
{
  "imported": 1,
  "ids": ["uuid-..."],
  "errors": []
}
```

---

### POST /api/v1/import/workblocks

Requires scope: `work:write`

```bash
curl -X POST https://your-instance.vercel.app/api/v1/import/workblocks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mmt_xxxx" \
  -d '{
    "workblocks": [
      {
        "title": "Revisar PR #42",
        "type": "review",
        "priority": "high",
        "status": "today"
      }
    ]
  }'
```

**Body:**
```ts
{
  workblocks: Array<{
    title: string;              // required
    type?: "ticket" | "task" | "meeting" | "review";  // default: "task"
    description?: string;
    status?: "backlog" | "today" | "in-progress" | "blocked" | "done";  // default: "backlog"
    priority?: "low" | "med" | "high";  // default: "med"
    due_date?: string;          // ISO date YYYY-MM-DD
    client?: string;
    notes?: string;
    links?: Record<string, string>;
  }>
}
```

---

### POST /api/v1/import/community

Requires scopes: `community:write` AND `organizations:write`

Creates organizations on-demand.

```bash
curl -X POST https://your-instance.vercel.app/api/v1/import/community \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mmt_xxxx" \
  -d '{
    "items": [
      {
        "organization_name": "UCEMA Alumni",
        "title": "Charla sobre emprendimiento",
        "status": "pending",
        "due_date": "2026-06-15"
      }
    ]
  }'
```

**Body:**
```ts
{
  items: Array<{
    organization_name: string;  // required — creates org if not found
    title: string;              // required
    description?: string;
    status?: "pending" | "done" | "cancelled";  // default: "pending"
    due_date?: string;          // ISO date YYYY-MM-DD
  }>
}
```

---

### POST /api/v1/import/freelance

Requires scope: `freelance:write`

Creates client and its tasks in a single transaction.

```bash
curl -X POST https://your-instance.vercel.app/api/v1/import/freelance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mmt_xxxx" \
  -d '{
    "clients": [
      {
        "name": "Acme Corp",
        "status": "active",
        "stack": "Next.js, Supabase",
        "tasks": [
          { "title": "Setup CI/CD", "priority": "high" },
          { "title": "Migrate DB schema", "priority": "med" }
        ]
      }
    ]
  }'
```

**Body:**
```ts
{
  clients: Array<{
    name: string;               // required
    description?: string;
    status?: "active" | "paused" | "blocked" | "archived";  // default: "active"
    icon?: string;
    stack?: string;
    next_step?: string;
    last_update?: string;
    links?: Record<string, string>;
    tasks?: Array<{
      title: string;            // required
      description?: string;
      status?: "backlog" | "today" | "in-progress" | "blocked" | "done";
      priority?: "low" | "med" | "high";
      due_date?: string;
    }>;
  }>
}
```

---

### POST /api/v1/import/build

Requires scope: `build:write`

```bash
curl -X POST https://your-instance.vercel.app/api/v1/import/build \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mmt_xxxx" \
  -d '{
    "items": [
      {
        "title": "Lanzamos Momentum MCP en Product Hunt",
        "type": "project",
        "status": "idea",
        "platforms": ["x", "linkedin"]
      }
    ]
  }'
```

**Body:**
```ts
{
  items: Array<{
    title: string;              // required
    type?: "hackathon" | "project" | "opinion" | "news" | "portfolio-update" | "open-source" | "demo";
    draft?: string;
    hook?: string;
    platforms?: string[];       // default: ["x", "linkedin"]
    status?: "idea" | "draft" | "scheduled" | "published" | "discarded";  // default: "idea"
    related_project?: string;
    links?: Record<string, string>;
  }>
}
```

---

## Error codes

| Status | Code | Meaning |
|--------|------|---------|
| 401 | `invalid_token` | Token missing, malformed, or hash not found |
| 401 | `token_expired` | Token past `expires_at` |
| 401 | `token_revoked` | Token has been revoked |
| 401 | `invalid_credentials` | Wrong email or password (login endpoint) |
| 401 | `unauthenticated` | Session cookie missing or invalid (tokens endpoint) |
| 403 | `insufficient_scope` | Token doesn't have a required scope |
| 403 | `setup_already_completed` | Setup endpoint called when admin already exists |
| 403 | `account_disabled` | Account is inactive |
| 400 | `invalid_request` | Body doesn't match schema (includes `issues` array) |
| 429 | `rate_limited` | Too many failed login attempts |
| 500 | `internal_error` | Unexpected server error |

**Error response shape:**
```json
{
  "error": "Human-readable message",
  "code": "machine_readable_code",
  "issues": [...]  // only present on 400
}
```

---

## Batch semantics

All import endpoints process items **one by one**, capturing per-item errors without aborting the whole batch (except `freelance`, which uses a transaction per client). A partial success returns `imported < total` with a non-empty `errors` array.

---

## Rate limiting

TODO: not implemented in v1. Planned for a future release using an in-memory sliding window or Redis.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-06-08 | Initial API — health, setup-status, import endpoints for all 6 pillars |
| 0.1.0 | 2026-06-08 | Sprint 4 — setup, login, tokens endpoints for programmatic bootstrap |
