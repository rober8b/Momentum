# CLAUDE.md — momentum

Personal daily dashboard de Rober. Multi-user (admin + members). 3 pilares: **Uni** (UCEMA) / **Work** (Aleph) / **Build** (X + LinkedIn). Capa operacional diaria por encima del vault de Obsidian (`C:\Users\rober\rober's workspace\`); exporta items completados semanalmente.

- **Live URL:** configurar dominio custom en Vercel → Settings → Domains
- **Plan original:** `C:\Users\rober\.claude\plans\tengo-menos-de-1k-effervescent-pizza.md`
- **Empezó:** 2026-06-03

> Este archivo es el manual operativo del proyecto. Si vas a tocar código y no leíste esto, parate y leelo. Para info más amplia de workspace, ver `C:\Users\rober\WEB_WORKSPACE\CLAUDE.md`.

---

## ⚠️ Next.js 16 — breaking changes

Esta versión tiene cambios respecto a 14/15 que no están en tu training data. APIs, convenciones, y file structure pueden diferir. **Leer `node_modules/next/dist/docs/` antes de tocar código framework-level.**

**Gotchas específicos que este proyecto ya navegó:**

- `middleware.ts` está **deprecado** → usar **`proxy.ts`** con `export const proxy = ...` (NO `export default`). El nuevo nombre tiene la misma API.
- `params` y `searchParams` son `Promise<...>` — siempre `await params` en server components.
- Tailwind v4 NO usa `tailwind.config.js`. Todos los tokens viven en `app/globals.css` dentro de `@theme inline { ... }`. PostCSS plugin: `@tailwindcss/postcss`.
- React 19 server actions usan `useActionState` (no el viejo `useFormState`).
- Routes lookup: la build genera `.next/types/validator.ts` que valida nombres de archivo — si borrás un page y aún aparece error 2307, hacer `rm -rf .next` y rebuild.

---

## Stack

| Layer | Tech | Notas |
|-------|------|-------|
| Framework | Next.js **16.2.6** + React **19.2.4** | App Router, sin `src/` dir |
| TypeScript | strict mode, target ES2017 | alias `@/*` → `./*` |
| Styling | Tailwind CSS **v4** + `@tailwindcss/postcss` | sin `tailwind.config.js` |
| UI primitives | `@base-ui/react` + custom + `lucide-react` | no shadcn |
| Animations | `motion` v12 | NO usar `framer-motion` |
| DB | **Railway Postgres** | conn string en `DATABASE_URL` |
| ORM | **Drizzle ORM** via `postgres-js` driver | singleton en `lib/db/index.ts` |
| Validation | `zod` v4 | en server actions, `z.record` requiere key+value type |
| Auth | bcrypt + HMAC-firmada cookie | multi-user, tabla `users`, sin servicios externos |
| i18n | `lib/strings.ts` + `t(key, lang)` | `en` / `es`, lang en `user.settings.language` |
| Pkg mgr | npm | `package-lock.json` en repo |
| Analytics | `@vercel/analytics` | inyectado en `app/layout.tsx` |
| Deploy | Vercel + cron | config en `vercel.json` |

---

## Commands

```bash
# Dev
npm run dev          # localhost:3000
npm run build        # production build
npm run typecheck    # tsc --noEmit (debe ser 0 errors)
npm run lint         # ESLint

# Drizzle
npx drizzle-kit push        # Sync schema → DB (dev rápido, sin migración formal)
npx drizzle-kit generate    # Genera nueva migración .sql en drizzle/ (para prod)
npx drizzle-kit studio      # GUI web para explorar la DB

# Verificación previa a deploy
npm run typecheck && npm run build
```

---

## Architecture map — IF-ELSE de dónde buscar contexto

| Necesitás trabajar en... | Buscá acá |
|--------------------------|-----------|
| Schema de la DB / agregar tablas o columnas | `lib/db/schema.ts` (single source of truth) |
| Cliente Postgres / conexión | `lib/db/index.ts` (singleton, no crear otro) |
| Tipos compartidos UI ↔ DB | `lib/types.ts` |
| Auth — verificación de sesión (Node runtime) | `lib/auth.ts` |
| Auth — middleware de protección (Edge runtime) | `proxy.ts` |
| Date helpers | `lib/date.ts` |
| i18n — strings en inglés y español | `lib/strings.ts` + función `t(key, lang)` |
| Today view — aggregator de los 3 pilares | `lib/today.ts` (también exporta row mappers) |
| Export semanal al vault | `lib/vault-export.ts` + `app/api/export/route.ts` |
| Server actions del pilar X | `app/<pilar>/actions.ts` |
| Página index del pilar X | `app/<pilar>/page.tsx` |
| Detalle de un ítem | `app/<pilar>/[id]/page.tsx` |
| Componentes del pilar X | `components/<pilar>/*.tsx` |
| Primitives reutilizables (Button, Card, Badge) | `components/ui/*.tsx` |
| Sidebar + mobile nav | `components/AppShell.tsx` |
| Export trigger desde UI | `components/ExportButton.tsx` |
| Tokens visuales (colors, radius, fonts, scrollbar) | `app/globals.css` |
| Login form + action | `app/login/page.tsx` + `app/login/actions.ts` + `app/login/LoginForm.tsx` |
| Logout | `app/logout/route.ts` |
| Settings — preferencias del usuario | `app/settings/profile/` + `app/settings/profile/actions.ts` |
| Settings — API tokens | `app/settings/api-tokens/` |
| Cron schedule | `vercel.json` |
| Convenciones de naming, formato de pages del vault | `C:\Users\rober\rober's workspace\CLAUDE.md` |

---

## Hard rules (max 15)

1. **YOU MUST llamar `await requireUser()` al top de cada Server Component y Server Action** que toque data privada. El `proxy.ts` es la primera línea de defensa; esto es la segunda. `requireUser()` retorna el `User` completo con `settings`.
2. **IMPORTANT: usar `db` y `schema` de `@/lib/db`, nunca crear otro cliente Postgres.** El singleton evita N conexiones en hot reload de Next dev.
3. **YOU MUST usar Server Actions para mutaciones.** No API routes. Única excepción: `/api/export` (es cron de Vercel), `/api/v1/*` (API pública con Bearer token), y `/logout` (route handler para soportar links).
4. **IMPORTANT: validar inputs con Zod** en cada server action antes de tocar la DB. Ver `app/work/actions.ts` como patrón canónico.
5. **YOU MUST llamar `revalidatePath('/')` y `revalidatePath('/<pilar>')` después de cada mutación** que afecte la Today view o el listado del pilar.
6. **IMPORTANT: usar `export const dynamic = 'force-dynamic'`** en toda page que haga queries — esta app es 100% server-rendered, no hay caching estático válido.
7. **IMPORTANT: en pages, devolver tipos del row mapper de `lib/today.ts`** (`rowToWorkblock`, etc.) para que UI reciba siempre el mismo shape — los timestamps salen como ISO string, no como Date.
8. **YOU MUST mantener `lib/types.ts` y `lib/db/schema.ts` sincronizados.** Los enums (`WorkblockStatus`, etc.) viven en `types.ts` — `schema.ts` los importa con `.$type<...>()`.
9. **NUNCA hardcodear valores de env.** Siempre `process.env.X` con check de undefined cuando falta.
10. **NUNCA commitear `.env.local`.** Ya está en `.gitignore` pero el riesgo es real.
11. **IMPORTANT: cambios mínimos.** No refactorizar código no relacionado con el pedido (Karpathy rule #3).
12. **NUNCA usar `framer-motion`.** El stack es `motion` v12 (es el sucesor oficial mantenido por el mismo equipo).
13. **NUNCA crear `tailwind.config.js`.** Tailwind v4 vive todo en `globals.css` con `@theme inline { ... }`.
14. **YOU MUST testear mobile (375px width)** en cualquier vista nueva — la app se usa desde el celular tanto o más que desktop.
15. **IMPORTANT: preguntar antes de agregar una dep nueva** — el stack actual cubre el 90% de lo que se necesita.

---

## Workflow preferences

- **Commits separados por unidad lógica.** No mezclar refactor + feature + fix en un solo commit.
- **Type check después de cada edit** (`npm run typecheck`). Antes de declarar algo terminado, también correr `npm run build`.
- **Si dudás entre 2 enfoques**, explicame ambos y elijo. No asumas.
- **No tocar `proxy.ts` ni `lib/auth.ts` sin avisarme** — la auth es crítica y los cambios silenciosos rompen la seguridad.
- **El vault de Obsidian** (`C:\Users\rober\rober's workspace\`) es territorio aparte — no editar desde este proyecto.
- **Si pegás un error de Next 16 que no entendés**, leer `node_modules/next/dist/docs/` antes de inventar una solución.
- **Idioma del UI:** español argentino, lowercase, sin mayúsculas innecesarias. Ver botones existentes (`"agregar"`, `"guardar"`, `"salir"`).
- **i18n:** strings de UI van en `lib/strings.ts`. Nunca hardcodear strings en componentes compartidos — usar `t(key, lang)`.

---

## Patrones canónicos

### Server component que lee data

```tsx
// app/work/page.tsx
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rowToWorkblock } from '@/lib/today';

export const dynamic = 'force-dynamic';

export default async function WorkPage() {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(schema.workblocks)
    .where(eq(schema.workblocks.user_id, user.id))   // siempre filtrar por user_id
    .orderBy(desc(schema.workblocks.created_at));
  const workblocks = rows.map(rowToWorkblock);
  return <KanbanBoard workblocks={workblocks} lang={user.settings.language} />;
}
```

### Server action canónico (con validación)

```ts
// app/work/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';

const inputSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(['low', 'med', 'high']).default('med'),
});

export async function createWorkblock(input: z.infer<typeof inputSchema>) {
  const user = await requireUser();                  // 1. auth — devuelve user completo
  const parsed = inputSchema.parse(input);           // 2. validate
  await db.insert(schema.workblocks).values({
    ...parsed,
    user_id: user.id,                                // 3. asociar al user
  });
  revalidatePath('/work');                           // 4. revalidate listado
  revalidatePath('/');                               // 5. revalidate Today
}
```

### Client component con server action

Ver `components/today/TicketCard.tsx`. Patrón: `useTransition` para feedback + `useState` para optimistic UI + server action dentro de `startTransition`.

```tsx
'use client';
import { useState, useTransition } from 'react';
import { updateWorkblockStatus } from '@/app/work/actions';

export function Card({ workblock }) {
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState(workblock.status);

  function advance(next: WorkblockStatus) {
    startTransition(async () => {
      setStatus(next);                                  // optimistic
      await updateWorkblockStatus(workblock.id, next);  // server
    });
  }
  // ...
}
```

### Drizzle: queries útiles

```ts
import { eq, and, or, ne, gte, lte, inArray, asc, desc, sql } from 'drizzle-orm';

// Igualdad
await db.select().from(schema.x).where(eq(schema.x.status, 'done'));

// Composición AND
await db.select().from(schema.x).where(
  and(eq(schema.x.status, 'done'), gte(schema.x.created_at, since))
);

// IN
await db.select().from(schema.x).where(inArray(schema.x.status, ['todo', 'in-progress']));

// Order custom (case/when para enums sin orden natural)
const PRIORITY_ORDER = sql`case ${schema.workblocks.priority}
  when 'high' then 0 when 'med' then 1 when 'low' then 2 else 3 end`;
await db.select().from(schema.workblocks).orderBy(PRIORITY_ORDER, asc(schema.workblocks.position));

// Limit + single result
const [row] = await db.select().from(schema.x).where(eq(schema.x.id, id)).limit(1);
if (!row) notFound();
```

---

## Database schema — overview

15 tablas en `lib/db/schema.ts`:

| Tabla | Para qué | Notas |
|-------|----------|-------|
| `users` | Cuentas de usuario. `settings: jsonb` con `UserSettings`. | `role: admin\|member`, `active: boolean` |
| `login_attempts` | Rate limiting de login por IP. | Auto-limpia registros viejos |
| `password_reset_tokens` | Tokens de reset de contraseña. | Expiran, uso único |
| `audit_log` | Log de acciones sensibles (login, create, delete, etc.). | Append-only |
| `subjects` | Materias UCEMA. `schedule: jsonb` con array de `ScheduleSlot`. | `active: boolean` |
| `assignments` | TPs de las materias. FK `subject_id` con cascade delete. | `todo` / `in-progress` / `done` |
| `workblocks` | Tickets/tasks en kanban. `client: text` libre. | `backlog` / `today` / `in-progress` / `blocked` / `done` |
| `build_items` | Posts de build-in-public. | `idea` / `draft` / `scheduled` / `published` / `discarded` |
| `freelance_clients` | Clientes de freelance. | `active` / `paused` / `blocked` / `archived` |
| `freelance_tasks` | Tasks de cada cliente freelance. FK `client_id`. | mismos status que workblocks |
| `own_projects` | Proyectos propios (side projects). | `active` / `paused` / `blocked` / `archived` |
| `organizations` | Organizaciones de comunidad (dinámica, no enum). | slug único por user |
| `community_items` | Compromisos de comunidad. FK `organization_id`. | `pending` / `done` / `cancelled` |
| `api_tokens` | Tokens de API para integración MCP/externa. | SHA-256 hash, scopes, revocable |
| `vault_exports` | Log del cron semanal — qué se exportó y cuándo. | `success` / `failure` / `partial` |

**Para cambiar el schema:**
1. Editar `lib/db/schema.ts`
2. Si agregás un enum value, también editarlo en `lib/types.ts`
3. `npx drizzle-kit push` (dev) o `npx drizzle-kit generate --name <descripcion>` (prod)
4. Si generaste migración: aplicarla con `psql $DATABASE_URL -f drizzle/000X_<name>.sql` o desde el Railway dashboard

### Migration workflow (post drift-cleanup, 2026-06-11)

`drizzle/` fue resincronizado a un único baseline (`0000_baseline.sql` + `meta/0000_snapshot.json`)
que representa el schema actual completo — la historia previa tenía 11 tablas creadas vía `push` que
nunca se capturaron en una migración, lo que rompía `drizzle-kit generate`.

Para que no vuelva a pasar:
- **`drizzle-kit generate` + commit es el flujo real.** Cada cambio a `lib/db/schema.ts` que vaya a
  prod debe generar su migración y commitearse junto con el cambio de schema.
- **`drizzle-kit push` es solo para experimentos descartables locales** (probar una idea rápido). Si
  el cambio se queda, generá la migración correspondiente antes de seguir — no lo dejes para después.
- Antes de generar, correr `npx drizzle-kit generate` sin cambios pendientes debería decir
  `No schema changes, nothing to migrate` — si no, hay drift que resolver primero.

---

## Auth flow — exhaustivo

**Setup inicial (primera vez):**
1. Con DB vacía, `/setup` (ruta pública) muestra el wizard de creación del primer admin
2. `setupAction` crea el usuario con `hashPassword(password)` (bcrypt, 12 rounds) y `role: 'admin'`
3. Post-setup → redirect a `/login`

**Login flow:**
1. POST email + password al server action `loginAction`
2. Consulta la DB: `SELECT * FROM users WHERE email = ? LIMIT 1`
3. `verifyPassword(input, user.password_hash)` — bcrypt compare, timing-safe
4. Si match → `signSession(userId)` genera cookie: `{userId}.{iat}.{hmac(userId.iat)}`
   - HMAC: SHA-256 sobre `"userId.iat"` usando `SESSION_SECRET`
   - `iat` = unix timestamp en segundos (habilita invalidación por usuario)
5. Cookie `momentum_session` seteada: HttpOnly, SameSite=Lax, Secure en prod, expires 30d
6. Redirect a `next` param (validado que empiece con `/` y no `//`)

**Request flow (protección en dos capas):**
1. Request entra → `proxy.ts` (Edge runtime, Web Crypto)
2. Path matchea `/login`, `/setup`, `/reset-password`, etc., o `/api/export` (cron), o `/api/v1/*` → pasa sin verificar cookie
3. `/signup` → solo pasa si `ALLOW_SIGNUP=true`, sino 404
4. Lee cookie `momentum_session` → verifica HMAC con `SESSION_SECRET` via `crypto.subtle`
5. Cookie inválida o ausente → redirect a `/login?next=<original>`
6. Cookie válida → continúa al handler
7. Server Component / Server Action llama `requireUser()` desde `lib/auth.ts` (Node runtime, `node:crypto`)
8. `requireUser()` re-verifica HMAC + consulta DB: busca user por `userId`, chequea `active` y `invalidate_sessions_before`
9. Si no auth → throw `'NOT_SIGNED_IN'` (Next captura como error)
10. Retorna `User` completo con `settings: UserSettings` mergeado con defaults

**Logout:** `/logout` route handler (acepta GET y POST) → `cookies().delete(COOKIE_NAME)` → redirect a `/login`.

**Invalidación de sesiones por usuario:** `users.invalidate_sessions_before` (unix timestamp). Setear este campo invalida todas las sesiones anteriores de ese usuario sin afectar a otros. Útil para "cerrar todas las sesiones activas" sin rotar `SESSION_SECRET`.

**Rotación de `SESSION_SECRET`** = invalida TODAS las cookies de TODOS los usuarios. Equivale a logout forzado global.

**NO modificar `proxy.ts` ni `lib/auth.ts` sin avisar** — son los archivos más sensibles del proyecto.

---

## user.settings

Cada usuario tiene `settings: jsonb` con tipo `UserSettings` de `lib/types.ts`:

```ts
type UserSettings = {
  timezone: string;       // IANA tz, e.g. 'America/Argentina/Buenos_Aires'. Default: 'UTC'
  language: 'en' | 'es'; // UI language. Default: 'en'
  theme: 'dark' | 'light'; // UI theme. Default: 'dark'
  export_enabled: boolean;  // Participar en cron semanal de vault export. Default: false
  vault_path: string;       // Path base en el vault Obsidian. Default: ''
};
```

- `requireUser()` siempre retorna user con `DEFAULT_USER_SETTINGS` mergeado — nunca undefined.
- Editar settings: `app/settings/profile/` (UI) + `app/settings/profile/actions.ts`.
- `vault_path` se usa en el cron de export como prefijo de los paths generados.

---

## API v1

**Base:** `/api/v1/` — auth via Bearer token (`Authorization: Bearer mmt_<64hex>`).

Endpoints:

| Method | Path | Scope | Descripción |
|--------|------|-------|-------------|
| GET | `/api/v1/health` | ninguno | DB ping, no auth |
| GET | `/api/v1/setup-status` | ninguno | Estado del setup, para herramientas externas |
| POST | `/api/v1/import/projects` | `projects:write` | Importar proyectos propios |
| POST | `/api/v1/import/assignments` | `uni:write` | Importar assignments universitarios |
| POST | `/api/v1/import/workblocks` | `work:write` | Importar workblocks |
| POST | `/api/v1/import/community` | `community:write` + `organizations:write` | Importar community items |
| POST | `/api/v1/import/freelance` | `freelance:write` | Importar clientes y tasks freelance |
| POST | `/api/v1/import/build` | `build:write` | Importar build items |

**Token format:** `mmt_` + 64 hex chars. Primeros 12 chars = prefix visible en UI. Hash SHA-256 en DB.

**Auth middleware:** `lib/api-auth.ts` — `requireApiToken(req, ['scope:needed'])`.

**Generar token:** `/settings/api-tokens` en la UI.

---

## MCP server

El servidor MCP de Momentum corre como proceso separado (otro repo). Se autentica con un API token de scope `projects:write`, `work:write`, etc. La configuración del MCP apunta a la URL del API v1.

Herramientas MCP disponibles: `analyze_vault_structure`, `detect_obsidian_vault`, `import_from_vault`, `setup_momentum`, `check_requirements`, `create_admin`.

---

## Vault export

**Cuándo:** cron de Vercel, **domingos 22:00 UTC** (config en `vercel.json`).

**Qué se exporta:** items con timestamp en los últimos 7 días:
- `workblocks` con `status='done'` y `completed_at >= startOfWeek`
- `assignments` con `status='done'` y `completed_at >= startOfWeek`
- `build_items` con `status='published'` y `published_at >= startOfWeek`

**Cómo:**
- `app/api/export/route.ts` (runtime `nodejs`) itera sobre todos los users con `settings.export_enabled = true`
- Para cada user, consulta la DB filtrada por `user_id`, llama a `buildExportFiles(payload, user.settings.vault_path)`
- `lib/vault-export.ts:buildExportFiles(payload, vaultPath)` genera markdown con frontmatter
- Si `vault_path` está vacío, los paths se generan bajo `momentum-export/`; si tiene valor, se usan como prefijo
- Devuelve JSON con `{ week, users: [...], files: [{userId, path, content}] }`
- `components/ExportButton.tsx` (en el sidebar) descarga un .md consolidado para drag → `00-inbox/` del vault

**Auth del cron:** Vercel manda header `Authorization: Bearer ${CRON_SECRET}`. El handler valida: si `CRON_SECRET` está seteado y el header no matchea → 401. Si en prod no está seteado → 500.

**V2 (TBD):** push directo a un repo de GitHub del vault via Octokit + Syncthing al vault local. Para eso están las vars `VAULT_REPO_OWNER`, `VAULT_REPO_NAME`, `GITHUB_TOKEN` en `.env.example`.

---

## Environment variables

| Var | Para qué | Requerido | Ejemplo |
|-----|----------|-----------|---------|
| `DATABASE_URL` | Conn string a Railway Postgres | siempre | `postgres://user:pass@host:port/db` |
| `SESSION_SECRET` | HMAC secret para firmar cookies | siempre | (32 bytes hex) |
| `NEXT_PUBLIC_SITE_URL` | URL base para logout redirect | opcional | `http://localhost:3000` |
| `CRON_SECRET` | Bearer token para cron de Vercel | prod | (string random) |
| `ALLOW_SIGNUP` | Habilitar ruta `/signup` | opcional | `true` / `false` |
| `VAULT_REPO_OWNER` | Owner del repo del vault | post-MVP | `bd-rober` |
| `VAULT_REPO_NAME` | Nombre del repo | post-MVP | `obsidian-vault` |
| `GITHUB_TOKEN` | PAT con scope `repo` | post-MVP | `ghp_...` |

**Generar `SESSION_SECRET`:**
```bash
# Bash / WSL / Git Bash
openssl rand -hex 32

# PowerShell
-join ((1..64) | %{ '{0:x}' -f (Get-Random -Max 16) })
```

---

## Deploy a producción

```bash
# 1. Railway — DB
# https://railway.app → New Project → Provision PostgreSQL
# Copiar DATABASE_URL desde Variables

# 2. GitHub
git init && git add -A
git commit -m "feat: momentum MVP"
git remote add origin git@github.com:rober8b/Momentum.git
git push -u origin main

# 3. Vercel
# vercel.com/new → import repo → setear env vars (mismas que .env.local)
# DATABASE_URL → la URL pública del Postgres de Railway (settings → networking → enable public)

# 4. Custom domain
# Vercel → settings → domains → agregar tu dominio y configurar CNAME en tu DNS

# 5. Verificar cron
# Vercel dashboard → settings → Crons → debería aparecer /api/export con schedule 0 22 * * 0
```

---

## What NOT to do

- ❌ **No agregar Clerk / Auth.js / NextAuth.** La auth multi-user propia es deliberada — bcrypt + HMAC es suficiente para esta app.
- ❌ **No volver a Supabase.** Railway + Drizzle es la decisión por scaling y type-safety.
- ❌ **No agregar libs de drag-and-drop al kanban.** Los botones de status change son suficientes y más mobile-friendly.
- ❌ **No agregar tests por agregar.** App personal — los tests vienen cuando hay un bug real para arreglar.
- ❌ **No tocar el vault de Obsidian** (`C:\Users\rober\rober's workspace\`) desde este repo. Son codebases separadas.
- ❌ **No agregar caching agresivo.** Toda la data es del usuario, `force-dynamic` es correcto.
- ❌ **No usar `'use client'` por default.** Empezá server, escalá a client solo si hay interactividad real.
- ❌ **No crear un cliente Supabase ni replicar el patrón viejo.** Drizzle es la única vía a la DB.
- ❌ **No agregar shadcn.** El stack usa `@base-ui/react` + primitives custom — mantener consistencia con `components/ui/`.
- ❌ **No hardcodear strings de UI en componentes.** Usar `t(key, lang)` de `lib/strings.ts`.

---

## Conexión con el vault de Obsidian

Esta app es la **capa operacional diaria**. El vault es la **capa de conocimiento de largo plazo**.

- **Project node:** `C:\Users\rober\rober's workspace\10-projects\aleph\aleph.md` (este repo lo referencia para tracking de sesiones)
- **Plan original:** `C:\Users\rober\.claude\plans\tengo-menos-de-1k-effervescent-pizza.md`
- **Export semanal:** ver sección "Vault export" arriba
- **Si el vault cambia su schema** (su `CLAUDE.md` raíz o estructura de carpetas), revisar que los paths de export sigan siendo válidos
- **Concepto madre:** [[llm-wiki-pattern]] en el vault — esta app es la *operational layer* del Second Brain del usuario

---

## Cheatsheet — tareas comunes

### Agregar una columna nueva a `workblocks`
1. Editar `lib/db/schema.ts` — agregar el campo
2. Editar `lib/types.ts` — actualizar el type `Workblock`
3. Editar `lib/today.ts:rowToWorkblock` — mapear la nueva columna
4. `npx drizzle-kit push`
5. Actualizar el server action en `app/work/actions.ts` si entra al insert/update
6. Actualizar el form/card si va en UI

### Agregar un nuevo pilar
1. Crear tabla en `lib/db/schema.ts`
2. Tipos en `lib/types.ts`
3. Row mapper en `lib/today.ts`
4. Server actions en `app/<pilar>/actions.ts`
5. Pages en `app/<pilar>/page.tsx` y `app/<pilar>/[id]/page.tsx`
6. Componentes en `components/<pilar>/`
7. Agregar a la Today view en `lib/today.ts:getTodayData` y `components/today/TodayDashboard.tsx`
8. Agregar al sidebar nav en `components/AppShell.tsx`
9. Extender `lib/vault-export.ts:buildExportFiles` si se exporta al vault

### Cambiar la password de un usuario
Opción A — desde la UI (si hay página de perfil con campo de contraseña):
1. Editar en `/settings/profile`

Opción B — desde la DB directamente:
```bash
# Generar hash con node
node -e "const b = require('bcryptjs'); b.hash('nueva_password', 12).then(h => console.log(h))"
# Luego en psql:
# UPDATE users SET password_hash = '<hash>' WHERE email = 'tu@email.com';
```

Opción C — invalidar todas las sesiones activas del usuario:
```sql
UPDATE users SET invalidate_sessions_before = EXTRACT(EPOCH FROM NOW())::bigint WHERE email = 'tu@email.com';
```

### Renombrar / migrar una tabla
1. Editar `lib/db/schema.ts` con el cambio
2. `npx drizzle-kit generate --name rename_x_to_y`
3. Revisar manualmente el SQL generado (drizzle-kit a veces sugiere drop+create — confirmar que no perdés data)
4. Aplicar la migración con `psql $DATABASE_URL -f drizzle/000X_*.sql`

---

## Referencias externas

- `C:\Users\rober\rober's workspace\80-wiki\concepts\claude-code-best-practices.md` — best practices de Claude Code
- `C:\Users\rober\rober's workspace\80-wiki\concepts\agentic-engineering.md` — principios de ingeniería agéntica
- `C:\Users\rober\rober's workspace\80-wiki\concepts\context-bloat.md` — por qué este CLAUDE.md está acotado a 15 hard rules
- `C:\Users\rober\WEB_WORKSPACE\CLAUDE.md` — overview del workspace
- `C:\Users\rober\WEB_WORKSPACE\portfolio-robertino\` — referencia del frontend stack (motion v12, base-ui, tokens OKLCH)
- `C:\Users\rober\WEB_WORKSPACE\lanza\` — referencia inicial del setup Clerk + Supabase (ahora deprecado en este proyecto, mantener como histórico)
