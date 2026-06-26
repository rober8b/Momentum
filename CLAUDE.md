# CLAUDE.md — momentum

Personal daily dashboard de Rober. Multi-user (admin + members). Capa operacional diaria por encima del vault de Obsidian (`C:\Users\rober\rober's-workspace\`); exporta items completados semanalmente.

Los pilares (Uni, Work, Build, Freelance, Projects, Community) corren sobre un **motor de pilares dinámico** (`pillars` + `pillar_items`) — ya no son tablas hardcodeadas. Ver "Dynamic pillar engine" abajo. Detalle histórico y runbooks largos viven en `docs/` (ver índice al final).

- **Plan original:** `C:\Users\rober\.claude\plans\tengo-menos-de-1k-effervescent-pizza.md`
- **Empezó:** 2026-06-03

> Manual operativo del proyecto. Si vas a tocar código y no leíste esto, parate y leelo.

---

## ⚠️ Next.js 16 — breaking changes (no están en tu training data)

- `middleware.ts` está **deprecado** → usar **`proxy.ts`** con `export const proxy = ...` (NO `export default`). Misma API.
- `params` y `searchParams` son `Promise<...>` — siempre `await` en server components.
- Tailwind v4 NO usa `tailwind.config.js`. Tokens en `app/globals.css` dentro de `@theme inline { ... }`. PostCSS: `@tailwindcss/postcss`.
- React 19 server actions usan `useActionState` (no `useFormState`).
- Si borrás un page y aún aparece error 2307: `rm -rf .next` y rebuild.
- Ante un error de Next 16 que no entendés: leer `node_modules/next/dist/docs/` antes de inventar solución.

---

## Stack

| Layer | Tech | Notas |
|-------|------|-------|
| Framework | Next.js **16.2.6** + React **19.2.4** | App Router, sin `src/` |
| TypeScript | strict, ES2017 | alias `@/*` → `./*` |
| Styling | Tailwind **v4** + `@tailwindcss/postcss` | sin `tailwind.config.js` |
| UI | `@base-ui/react` + custom + `lucide-react` | no shadcn |
| Animations | `motion` v12 | NO `framer-motion` |
| DB | **Railway Postgres** (prod) / **Docker Postgres** (local dev) | conn en `DATABASE_URL` |
| ORM | **Drizzle ORM** via `postgres-js` | singleton en `lib/db/index.ts` |
| Validation | `zod` v4 | en server actions |
| Auth | bcrypt + HMAC cookie | multi-user, tabla `users`, sin servicios externos |
| i18n | `lib/strings.ts` + `t(key, lang)` | `en`/`es`, lang en `user.settings.language` |
| Pkg mgr | npm | |
| Deploy | Vercel + cron | `vercel.json` |
| Billing | Polar (Merchant of Record) | solo `MOMENTUM_MODE=hosted` |
| Tests | Vitest | `*.test.ts` junto al código, sin DB real |

---

## Commands

```bash
npm run dev          # localhost:3000
npm run build        # production build
npm run typecheck    # tsc --noEmit (debe ser 0 errors)
npm run lint         # ESLint
npm test             # vitest run

# Local Postgres (Docker)
npm run db:up           # arranca contenedor local
npm run db:down         # detiene, CONSERVA datos
npm run db:down:volume  # detiene y BORRA datos (fresh start)

# Drizzle / migraciones
npx drizzle-kit generate --name <desc>   # nueva migración (flujo real)
npm run db:migrate:local                 # aplica migraciones a .env.local DB
npm run db:migrate                       # lee DATABASE_URL del entorno (lo corre Vercel en deploy)

# Migrar un pilar legacy → motor dinámico (local, supervisado)
npm run migrate:<pilar>:local   # projects | freelance | community | uni | build | work
```

---

## Dynamic pillar engine

**Estado: los 7 pilares están migrados al motor dinámico, LOCALMENTE. Prod (Railway) sigue en legacy — nunca se cutoveó.** Diseño completo y plan de fases en `docs/DYNAMIC_PILLARS.md`.

- **Tablas:** `pillars` (por-user: key, name, icon, view_type, status_workflow jsonb, config jsonb, source_template, is_archived) + `pillar_items` (user_id, pillar_id, `parent_item_id` self-ref, `is_container` bool explícito, title, status, due_date, completed_at, position, `fields` jsonb, is_sample).
- **Storage híbrido:** columnas tipadas para lo común (status/due_date/completed_at/position), `fields` jsonb para lo específico del pilar.
- **Jerarquía:** `parent_item_id` + discriminador `is_container` EXPLÍCITO (un contenedor se declara, el renderer nunca infiere). Un hijo apunta a un `is_container` del mismo pilar.
- **Vistas genéricas:** list / kanban / grid, parametrizadas por `pillar.config`. Vistas exóticas (schedule de Uni) van como `custom` renderer registrado en código, NO generalizadas.
- **Templates:** los pilares predefinidos son config en `lib/pillar-templates.ts`, instanciables insertando una fila en `pillars`. CRUD genérico en `app/p/actions.ts`. Escrituras compartidas (import/sample) en `lib/pillar-writes.ts`.
- **Validación de status:** a nivel app (Zod) contra el `status_workflow` del pilar — no hay enum de DB para status dinámicos.

### Rollback flags (lib/pillar-flags.ts) — ⚠️ ARMA CARGADA APUNTANDO A PROD

`PROJECTS_/FREELANCE_/COMMUNITY_/UNI_/BUILD_/WORK_DYNAMIC_ENGINE`, **todos default ON** (legacy solo si `=false`).

**Cada ruta de pilar bifurca:** flag ON → lee `pillar_items`; OFF → código legacy byte-por-byte intacto. Las tablas legacy NUNCA se borran ni se escriben desde el path dinámico — son la red de rollback.

**El riesgo crítico para prod:** los scripts `migrate-*` NUNCA corrieron contra Railway, así que `pillar_items` está VACÍA en prod. Si este código llega a prod con los flags en default (ON), los 7 pilares se renderizan vacíos para todos los usuarios al instante. **Antes de cualquier deploy a prod: setear los 6 flags en `false` en Vercel env, correr la migración 0005, correr los `migrate-*` contra Railway supervisado, verificar round-trip, backup fresco, y RECIÉN AHÍ prender los flags uno por uno.** No hay guard en código que prevenga esto — la seguridad es procedural.

### Subsistemas cross-cutting (ya wireados a los 7 pilares vía los flags)

Today (`lib/today.ts`), search (`app/search/actions.ts`), export (`app/api/export/route.ts`), plan limits (`lib/limits.ts`), API v1 import (`app/api/v1/import/*`), sample data (`app/settings/sample-data/actions.ts`). Cada uno bifurca en el flag del pilar.

### Deuda conocida (verificar en `docs/DYNAMIC_PILLARS.md` antes de asumir resuelta)

- Plan limits rediseñados en Sprint 11 — `FREE_LEAF_ITEM_LIMIT = 150` en `lib/plans.ts`, conteo único cross-pilar en `lib/limits.ts`. Contenedores nunca bloqueados.
- `/uni/[subject]/[assignment]` (detalle de assignment) sigue leyendo tablas legacy — no cutoveado.
- Vistas genéricas menos pulidas que las bespoke (Kanban perdió colores por columna, etc.) — costo aceptado, mejora de UX futura.
- `legacy_source`/`legacy_id` para idempotencia de migración viven en `fields` jsonb, no en columna dedicada.

---

## Hard rules

1. **YOU MUST `await requireUser()` al top de cada Server Component y Server Action** que toque data privada. Retorna el `User` completo con `settings`.
2. **Usar `db` y `schema` de `@/lib/db`, NUNCA crear otro cliente Postgres** (el singleton evita N conexiones en hot reload).
3. **Server Actions para mutaciones**, no API routes. Excepciones: `/api/export` (cron), `/api/v1/*` (API pública con Bearer), `/logout`.
4. **Validar inputs con Zod** en cada server action antes de tocar la DB.
5. **`revalidatePath('/')` + `revalidatePath('/<pilar>')`** después de cada mutación que afecte Today o el listado. Para pilares dinámicos ver `revalidatePillarRoutes` en `app/p/actions.ts`.
6. **`export const dynamic = 'force-dynamic'`** en toda page que haga queries (app 100% server-rendered).
7. **Mantener `lib/types.ts` y `lib/db/schema.ts` sincronizados.** Los enums viven en `types.ts`.
8. **NUNCA hardcodear env.** `process.env.X` con check de undefined.
9. **NUNCA commitear `.env.local`** (ya en `.gitignore`).
10. **Cambios mínimos.** No refactorizar código no relacionado al pedido.
11. **NUNCA `framer-motion`** (el stack es `motion` v12). **NUNCA `tailwind.config.js`** (v4 vive en `globals.css`).
12. **Testear mobile (375px)** en cualquier vista nueva.
13. **No tocar `proxy.ts` ni `lib/auth.ts` sin avisar** — auth crítica.
14. **Preguntar antes de agregar una dep nueva.**
15. **Commits separados por unidad lógica.** No mezclar refactor + feature + fix.

---

## Workflow preferences

- **Si dudás entre 2 enfoques, explicá ambos y que Rober elija.** No asumas.
- Typecheck después de cada edit; `npm run build` antes de declarar algo terminado.
- **Idioma UI:** español argentino, lowercase. Strings en `lib/strings.ts` via `t(key, lang)`, nunca hardcodeadas en componentes compartidos.
- El vault de Obsidian (`C:\Users\rober\rober's-workspace\`) es territorio aparte — no editar desde este repo.
- DB local (Docker) es el DEFAULT para dev. Railway es opt-in explícito y peligroso (ver `docs/DATABASE.md`).

---

## Architecture map — dónde buscar contexto

| Trabajar en... | Buscá acá |
|----------------|-----------|
| Schema DB | `lib/db/schema.ts` (single source of truth) |
| Cliente Postgres | `lib/db/index.ts` (singleton) |
| Tipos compartidos | `lib/types.ts` |
| Auth — sesión (Node) | `lib/auth.ts` |
| Auth — middleware (Edge) | `proxy.ts` |
| i18n | `lib/strings.ts` |
| Today aggregator | `lib/today.ts` (también row mappers) |
| Motor de pilares — CRUD genérico | `app/p/actions.ts` |
| Motor de pilares — escrituras compartidas | `lib/pillar-writes.ts` |
| Motor de pilares — templates | `lib/pillar-templates.ts` |
| Motor de pilares — flags | `lib/pillar-flags.ts` |
| Vistas genéricas | `components/pillars/Generic{Grid,List,Kanban}.tsx` |
| Ruta de pilar (legacy + branch dinámico) | `app/<pilar>/page.tsx` |
| Componentes UI reutilizables | `components/ui/*.tsx` (incl. `FormDialog`, `Pagination`) |
| Sidebar + mobile nav | `components/AppShell.tsx` |
| Tokens visuales | `app/globals.css` |
| Login | `app/login/` |
| Settings | `app/settings/profile/`, `/billing/`, `/api-tokens/`, `/sample-data/` |
| Cron schedule | `vercel.json` |

---

## Patrón canónico — server action con auth + validación

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';

const inputSchema = z.object({ title: z.string().min(1) });

export async function createThing(input: z.infer<typeof inputSchema>) {
  const user = await requireUser();          // 1. auth
  const parsed = inputSchema.parse(input);    // 2. validate
  await db.insert(schema.x).values({ ...parsed, user_id: user.id }); // 3. scope al user
  revalidatePath('/');                        // 4. revalidate
}
```

Para más patrones (server component que lee data, client component con server action, queries Drizzle, paginación) ver `docs/PATTERNS.md`.

---

## Plans & limits (freemium)

`MOMENTUM_MODE`: `self_hosted` (default, incl. `undefined`) = `checkLimit()` siempre `allowed: true` sin tocar la DB. `hosted` = aplica `lib/plans.ts:PLAN_LIMITS` según `user.plan` (`free`|`pro`; pro = unlimited).

Para ajustar el límite: cambiar `FREE_LEAF_ITEM_LIMIT` en `lib/plans.ts`.

Enforced en: server actions de creación (`checkLimit` antes del insert), `/api/v1/import/*`, y mostrado en `/settings/profile` (`PlanSection`).

---

## Billing — Polar (resumen)

Polar = Merchant of Record. Solo `MOMENTUM_MODE=hosted`; self-host deja `POLAR_*` sin setear y todo queda inerte (webhook 404).

Flujo: `Checkout → webhook → users.plan/plan_status → checkLimit()`. El webhook es la única fuente de verdad. El mapeo evento→estado vive en `lib/polar-webhook.ts:resolvePolarEvent` (función pura, testeada — es dinero, no reinsertar el switch inline en la route). `subscription.revoked` es el ÚNICO downgrade a `free`.

Setup completo, tabla de eventos, y archivos clave en `docs/BILLING.md`.

---

## API v1 + MCP (resumen)

`/api/v1/` — auth Bearer (`mmt_<64hex>`). Endpoints `/import/{projects,assignments,workblocks,community,freelance,build}` con scopes. Rate limiting por-token en `lib/rate-limits.ts` (hosted 10/min, self-host 60/min). El MCP server (otro repo) consume esta API. Detalle en `docs/API.md`.

---

## Tests

Vitest, `*.test.ts` junto al código. Mocks de DB en `test/stubs/db-mock.ts` (sin Postgres real). Cubre los flujos donde un bug es caro: **dinero** (`lib/polar-webhook.test.ts`) y **acceso** (`lib/auth.test.ts`, `lib/limits.test.ts`, `app/admin/actions.test.ts`). No agregar tests por agregar — vienen cuando hay un flujo de dinero/acceso nuevo o un bug real. Detalle de mocking en `docs/PATTERNS.md` (sección Tests).

---

## What NOT to do

- ❌ No agregar Clerk / Auth.js / NextAuth (auth propia es deliberada).
- ❌ No volver a Supabase (Railway + Drizzle es la decisión).
- ❌ No agregar libs de drag-and-drop al kanban (botones de status son suficientes y mobile-friendly).
- ❌ No tocar el vault de Obsidian desde este repo.
- ❌ No agregar caching agresivo (`force-dynamic` es correcto).
- ❌ No `'use client'` por default (empezá server).
- ❌ No agregar shadcn (stack usa `@base-ui/react`).
- ❌ No hardcodear strings de UI (usar `t(key, lang)`).

---

## docs/ — referencia detallada (no se carga siempre, leer cuando aplique)

- `docs/DYNAMIC_PILLARS.md` — diseño completo del motor dinámico, decisiones, plan de fases 0-6, deuda.
- `docs/DATABASE.md` — schema completo, migration workflow, baselining, local dev DB (Docker), apuntar a Railway.
- `docs/BACKUPS.md` — workflow de backup encriptado + runbook de restore (drill local y recovery real). Incluye el quirk `MSYS_NO_PATHCONV=1` de Windows.
- `docs/BILLING.md` — setup de Polar, tabla evento→estado completa, archivos.
- `docs/API.md` — API v1 endpoints/scopes, rate limiting, MCP server.
- `docs/AUTH.md` — flujo de auth exhaustivo, setup inicial, invalidación de sesiones.
- `docs/PATTERNS.md` — patrones canónicos de código, queries Drizzle, paginación, cheatsheet.
- `docs/ENV.md` — variables de entorno, deploy a producción.
- `C:\Users\rober\rober's-workspace\CLAUDE.md` — overview del workspace + convenciones del vault.
