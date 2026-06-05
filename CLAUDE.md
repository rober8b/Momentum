# CLAUDE.md — command-center

Personal daily dashboard de Rober. Single-user. 3 pilares: **Uni** (UCEMA) / **Work** (Aleph) / **Build** (X + LinkedIn). Capa operacional diaria por encima del vault de Obsidian (`C:\Users\rober\rober's workspace\`); exporta items completados semanalmente.

- **Live URL planeada:** `cc.roberb.dev` (subdominio de roberb.dev)
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
| Auth | password + HMAC-firmada cookie | single-user, sin servicios externos |
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
| Cron schedule | `vercel.json` |
| Convenciones de naming, formato de pages del vault | `C:\Users\rober\rober's workspace\CLAUDE.md` |

---

## Hard rules (max 15)

1. **YOU MUST llamar `await requireRober()` al top de cada Server Component y Server Action** que toque data privada. El `proxy.ts` es la primera línea de defensa; esto es la segunda.
2. **IMPORTANT: usar `db` y `schema` de `@/lib/db`, nunca crear otro cliente Postgres.** El singleton evita N conexiones en hot reload de Next dev.
3. **YOU MUST usar Server Actions para mutaciones.** No API routes. Única excepción: `/api/export` (es cron de Vercel) y `/logout` (route handler para soportar links).
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

---

## Patrones canónicos

### Server component que lee data

```tsx
// app/work/page.tsx
import { desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireRober } from '@/lib/auth';
import { rowToWorkblock } from '@/lib/today';

export const dynamic = 'force-dynamic';

export default async function WorkPage() {
  await requireRober();
  const rows = await db
    .select()
    .from(schema.workblocks)
    .orderBy(desc(schema.workblocks.created_at));
  const workblocks = rows.map(rowToWorkblock);
  return <KanbanBoard workblocks={workblocks} />;
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
import { requireRober } from '@/lib/auth';

const inputSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(['low', 'med', 'high']).default('med'),
});

export async function createWorkblock(input: z.infer<typeof inputSchema>) {
  await requireRober();                          // 1. auth
  const parsed = inputSchema.parse(input);       // 2. validate
  await db.insert(schema.workblocks).values(parsed); // 3. mutate
  revalidatePath('/work');                       // 4. revalidate listado
  revalidatePath('/');                           // 5. revalidate Today
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

5 tablas en `lib/db/schema.ts`:

| Tabla | Para qué | Estados |
|-------|----------|---------|
| `subjects` | Materias UCEMA. `schedule: jsonb` con array de `ScheduleSlot`. | `active: boolean` |
| `assignments` | TPs de las materias. FK `subject_id` con cascade delete. | `todo` / `in-progress` / `done` |
| `workblocks` | Tickets/tasks de Aleph en kanban. | `backlog` / `today` / `in-progress` / `blocked` / `done` |
| `build_items` | Posts de build-in-public. | `idea` / `draft` / `scheduled` / `published` / `discarded` |
| `vault_exports` | Log del cron semanal — qué se exportó y cuándo. | `success` / `failure` / `partial` |

**Para cambiar el schema:**
1. Editar `lib/db/schema.ts`
2. Si agregás un enum value, también editarlo en `lib/types.ts`
3. `npx drizzle-kit push` (dev) o `npx drizzle-kit generate --name <descripcion>` (prod)
4. Si generaste migración: aplicarla con `psql $DATABASE_URL -f drizzle/000X_<name>.sql` o desde el Railway dashboard

---

## Auth flow — exhaustivo

**Vars de entorno:**
- `APP_PASSWORD` — password única para entrar
- `SESSION_SECRET` — HMAC secret (min 16 chars, recomendado 32+)

**Cookie:** `cc_session` — formato `ok.<hmac-base64url>`, HttpOnly, SameSite=Lax, Secure en prod, expires 30d.

**Flujo:**

1. Request entra → `proxy.ts` (Edge runtime, Web Crypto)
2. Path matchea `/login` o `/api/export` (cron) → pasa
3. Lee cookie `cc_session` → verifica HMAC con `SESSION_SECRET` via `crypto.subtle`
4. Cookie inválida o ausente → redirect a `/login?next=<original>`
5. Cookie válida → continúa al handler
6. Server Component / Server Action llama `requireRober()` desde `lib/auth.ts` (Node runtime, `node:crypto`)
7. `requireRober()` re-verifica con `verifySession()` usando `timingSafeEqual` para evitar timing leaks
8. Si no auth → throw `'NOT_SIGNED_IN'` (Next captura como error)

**Login flow:**
1. POST password al server action `loginAction`
2. `passwordMatches(input)` compara con `APP_PASSWORD` usando `timingSafeEqual`
3. Si match → `signSession()` genera HMAC + setea cookie
4. Redirect a `next` (validado que empiece con `/` y no `//` para evitar open redirect)

**Logout:** `/logout` route handler (acepta GET y POST) → `cookies().delete(COOKIE_NAME)` → redirect a `/login`.

**Rotación de `SESSION_SECRET`** = invalida automáticamente todas las cookies existentes (el HMAC ya no matchea). Equivale a "logout forzado".

**NO modificar `proxy.ts` ni `lib/auth.ts` sin avisar** — son los archivos más sensibles del proyecto.

---

## Vault export

**Cuándo:** cron de Vercel, **domingos 22:00 UTC** (config en `vercel.json`).

**Qué se exporta:** items con timestamp en los últimos 7 días:
- `workblocks` con `status='done'` y `completed_at >= startOfWeek`
- `assignments` con `status='done'` y `completed_at >= startOfWeek`
- `build_items` con `status='published'` y `published_at >= startOfWeek`

**Cómo:**
- `app/api/export/route.ts` (runtime `nodejs`) consulta la DB
- `lib/vault-export.ts:buildExportFiles()` genera markdown con frontmatter siguiendo el schema del vault
- Devuelve JSON con `{ week, counts, summary, files: [{path, content}] }`
- `components/ExportButton.tsx` (en el sidebar) descarga un .md consolidado para drag → `00-inbox/` del vault → `/ingest`

**Paths target en el vault:**
- `30-personal/work/aleph/sessions/YYYY-MM-DD-week.md` (workblocks)
- `20-studies/ucema/<vault_slug>/log.md` (assignments — append por materia)
- `30-personal/build-log/YYYY-MM-DD-week.md` (build items)

**V2 (TBD):** push directo a un repo de GitHub del vault via Octokit + Syncthing al vault local. Para eso están las vars `VAULT_REPO_OWNER`, `VAULT_REPO_NAME`, `GITHUB_TOKEN` en `.env.example`.

**Auth del cron:** Vercel manda header `Authorization: Bearer ${CRON_SECRET}`. El handler valida (TBD: actualmente comentado, agregar validación antes de prod).

---

## Environment variables

| Var | Para qué | Requerido | Ejemplo |
|-----|----------|-----------|---------|
| `DATABASE_URL` | Conn string a Railway Postgres | siempre | `postgres://user:pass@host:port/db` |
| `APP_PASSWORD` | Password del único usuario (Rober) | siempre | (cualquier string) |
| `SESSION_SECRET` | HMAC secret para firmar cookies | siempre | (32 bytes hex) |
| `NEXT_PUBLIC_SITE_URL` | URL base para logout redirect | opcional | `http://localhost:3000` |
| `CRON_SECRET` | Bearer token para cron de Vercel | prod | (string random) |
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
git commit -m "feat: command-center MVP"
git remote add origin git@github.com:bd-rober/command-center.git
git push -u origin main

# 3. Vercel
# vercel.com/new → import repo → setear env vars (mismas que .env.local)
# DATABASE_URL → la URL pública del Postgres de Railway (settings → networking → enable public)

# 4. Custom domain
# Vercel → settings → domains → cc.roberb.dev
# Configurar CNAME en el DNS de roberb.dev

# 5. Verificar cron
# Vercel dashboard → settings → Crons → debería aparecer /api/export con schedule 0 22 * * 0
```

---

## What NOT to do

- ❌ **No agregar Clerk / Auth.js / NextAuth.** La auth simple es deliberada. Si necesitás multi-user en el futuro, lo discutimos primero.
- ❌ **No volver a Supabase.** Railway + Drizzle es la decisión por scaling y type-safety.
- ❌ **No agregar libs de drag-and-drop al kanban.** Los botones de status change son suficientes y más mobile-friendly.
- ❌ **No agregar tests por agregar.** App personal — los tests vienen cuando hay un bug real para arreglar.
- ❌ **No tocar el vault de Obsidian** (`C:\Users\rober\rober's workspace\`) desde este repo. Son codebases separadas.
- ❌ **No agregar caching agresivo.** Toda la data es del usuario, `force-dynamic` es correcto.
- ❌ **No usar `'use client'` por default.** Empezá server, escalá a client solo si hay interactividad real.
- ❌ **No crear un cliente Supabase ni replicar el patrón viejo.** Drizzle es la única vía a la DB.
- ❌ **No agregar shadcn.** El stack usa `@base-ui/react` + primitives custom — mantener consistencia con `components/ui/`.

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

### Cambiar la password
1. Editar `APP_PASSWORD` en `.env.local` (dev) o en Vercel env vars (prod)
2. Restart del dev server
3. (Opcional) Rotar `SESSION_SECRET` para invalidar sesiones existentes

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
