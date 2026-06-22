# CLAUDE.md — momentum

Personal daily dashboard de Rober. Multi-user (admin + members). 3 pilares: **Uni** (UCEMA) / **Work** (Aleph) / **Build** (X + LinkedIn). Capa operacional diaria por encima del vault de Obsidian (`C:\Users\rober\rober's-workspace\`); exporta items completados semanalmente.

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
npm test             # vitest run (suite completa, sin DB real)
npm run test:watch   # vitest en watch mode

# Local Postgres (Docker) — ver "Local dev database" más abajo
npm run db:up           # arranca el contenedor Postgres local (docker-compose.dev.yml)
npm run db:down         # detiene el contenedor, conserva los datos (volumen)
npm run db:down:volume  # detiene y BORRA todos los datos (fresh start)

# Drizzle
npx drizzle-kit push        # Sync schema → DB (SOLO experimentos descartables en local)
npx drizzle-kit generate    # Genera nueva migración .sql en drizzle/ (flujo real, prod)
npx drizzle-kit studio      # GUI web para explorar la DB

# Migraciones (ver "Migration workflow — automated on deploy" más abajo)
npm run db:migrate:local    # aplica migraciones pendientes a DATABASE_URL de .env.local
npm run db:migrate          # idem, lee DATABASE_URL del entorno (lo corre Vercel en cada deploy)
npm run db:baseline:local   # one-time: marca migraciones existentes como aplicadas sin correrlas

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
| Convenciones de naming, formato de pages del vault | `C:\Users\rober\rober's-workspace\CLAUDE.md` |

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
- **El vault de Obsidian** (`C:\Users\rober\rober's-workspace\`) es territorio aparte — no editar desde este proyecto.
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

## Pagination

**Patrón: lo activo queda sin límite, lo histórico (`done`/`archived`/`cancelled`) se pagina a nivel SQL.**
Las listas de pilares (work, build, freelance, projects, community, uni) muestran datos activos en boards
Kanban o vistas agrupadas — ese set es chico por naturaleza (tu carga de trabajo actual) y romperlo en
páginas arruinaría la UX del Kanban. Lo que crece sin límite con el tiempo es lo *completado* — años de
workblocks en `done`, posts publicados, proyectos archivados. Eso es lo que se pagina.

**Nunca** uses `.slice(0, N)` en JS después de un fetch sin límite — eso sigue trayendo la tabla entera a
Node antes de cortarla. El límite va en la query SQL (`.limit().offset()` + un `count()` separado para el
total), no después.

Componente reutilizable: `components/ui/Pagination.tsx` (antes vivía solo en `components/admin/`, se movió
porque ahora lo usan también los pilares). Acepta `paramName` para soportar más de una sección paginada en
la misma page (ej. `app/build/page.tsx` pagina `published` y `discarded` por separado con `pubPage` y
`discPage`).

```ts
// Patrón canónico — ver app/work/page.tsx (done column del Kanban) o app/projects/page.tsx (archivados)
const PAGE_SIZE = 24;
const { donePage: pageParam } = await searchParams; // searchParams es Promise en Next 16
const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);

const [activeRows, doneRows, [{ count: doneCount }]] = await Promise.all([
  db.select().from(schema.x).where(and(eq(schema.x.user_id, user.id), ne(schema.x.status, 'done'))), // sin límite
  db.select().from(schema.x)
    .where(and(eq(schema.x.user_id, user.id), eq(schema.x.status, 'done')))
    .orderBy(desc(schema.x.created_at))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE),
  db.select({ count: sql<number>`count(*)::int` }).from(schema.x)
    .where(and(eq(schema.x.user_id, user.id), eq(schema.x.status, 'done'))),
]);

const doneTotalPages = Math.max(1, Math.ceil(doneCount / PAGE_SIZE));
// <Pagination basePath="/work" page={page} totalPages={doneTotalPages} paramName="donePage" />
```

**Si agregás una página de pilar nueva con un bucket histórico que puede crecer sin límite**, seguí este
mismo patrón — no hace falta pedir permiso para replicarlo, pero si el bucket "activo" también puede crecer
sin límite con el tiempo (no es obviamente acotado por naturaleza), pensalo dos veces antes de asumir que no
necesita paginación.

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

**Para cambiar el schema (flujo real, prod):**
1. Editar `lib/db/schema.ts`
2. Si agregás un enum value, también editarlo en `lib/types.ts`
3. `npx drizzle-kit generate --name <descripcion>` — genera `drizzle/000X_<descripcion>.sql`
4. Revisar el SQL generado, commitear junto con el cambio de schema
5. `git push` → Vercel corre `db:migrate` automáticamente en el build (ver abajo) y aplica la
   migración a prod. No hace falta correr nada a mano contra Railway.

**`npx drizzle-kit push` es SOLO para experimentos descartables en local** (probar una idea rápido,
sin generar migración). Si el cambio se queda, generá la migración (`drizzle-kit generate`) antes de
seguir — **nunca correr `push` contra `DATABASE_URL` de prod**, porque eso aplica el schema sin
dejar rastro en `drizzle/`, volviendo a romper el tracking de `__drizzle_migrations`.

### Migration workflow — automated on deploy (2026-06-12)

Las migraciones ahora se aplican automáticamente en cada deploy de Vercel:

- `npm run vercel-build` (= `npm run db:migrate && next build`) es el build command real en Vercel
  (Vercel detecta `vercel-build` en `package.json` y lo usa en vez de `build`). `npm run build` /
  `npm run dev` en local **no** corren migraciones — solo Vercel las corre, y solo si hay env
  `DATABASE_URL` configurada para ese entorno (Production/Preview).
- `npm run db:migrate` (`scripts/db-migrate.ts`) usa `migrate()` de `drizzle-orm/postgres-js/migrator`
  sobre `./drizzle`. Es **idempotente**: si no hay migraciones pendientes (según
  `drizzle.__drizzle_migrations`), no hace nada. Si `DATABASE_URL` no está seteada, la conexión falla,
  o una migración tira error → `process.exit(1)` → el build de Vercel falla y el deploy se bloquea
  (fail loud, nunca silencioso).
- **Self-host:** si corrés tu propia instancia (no Vercel), corré `npm run db:migrate:local`
  (lee `.env.local`) después de cada `git pull` que incluya nuevas migraciones en `drizzle/`.

**Para que `drizzle-kit generate` no vuelva a romperse por drift:**
- **`drizzle-kit generate` + commit es el flujo real.** Cada cambio a `lib/db/schema.ts` que vaya a
  prod debe generar su migración y commitearse junto con el cambio de schema.
- Antes de generar, correr `npx drizzle-kit generate` sin cambios pendientes debería decir
  `No schema changes, nothing to migrate` — si no, hay drift que resolver primero.

### Baselinear una DB existente (fresh prod o recovery de drift)

Si una DB ya tiene el schema completo aplicado vía `push` (o cualquier otra vía) pero **no** tiene la
tabla `drizzle.__drizzle_migrations`, el primer `migrate()` va a intentar re-correr `0000_baseline.sql`
(`CREATE TABLE ...`) y falla porque las tablas ya existen.

Fix: `npm run db:baseline` (`scripts/db-baseline.ts`) — crea `drizzle.__drizzle_migrations` (additive,
`CREATE SCHEMA/TABLE IF NOT EXISTS`) y marca cada entry de `drizzle/meta/_journal.json` como ya
aplicada (`hash = sha256(archivo .sql)`, `created_at = journal.when`), **sin ejecutar el SQL**. Es
idempotente — si la tabla ya tiene filas, solo las imprime y no hace nada.

- DB nueva (sin tablas todavía): NO uses `db:baseline` — corré `db:migrate` directo, que va a crear
  todo desde `0000_baseline.sql`.
- DB con schema ya aplicado pero sin tracking (caso de hoy, 2026-06-12 — prod corrió `push` antes de
  tener migraciones automatizadas): correr `db:baseline` (local: `db:baseline:local` con
  `DATABASE_URL` apuntando a esa DB) **una sola vez**, después `db:migrate` queda al día.
- Si migraciones y DB vuelven a driftear (alguien corrió `push` contra prod a mano): no hay arreglo
  automático — hay que comparar `drizzle-kit generate` (debería decir "No schema changes") y si hay
  diff, decidir manualmente si generar una migración correctiva o re-baselinear.

---

## Local dev database (Docker)

**Default para desarrollo local.** Un Postgres 16 en Docker completamente separado de Railway/prod. Las credenciales son locales y están commiteadas intencionalmente — no son secretos.

```
Host:     localhost:5432
User:     momentum
Password: momentum
DB:       momentum
URL:      postgres://momentum:momentum@localhost:5432/momentum
```

### Bootstrap (primera vez o reset)

```bash
# 1. Asegurarse de tener Docker Desktop corriendo
npm run db:up              # arranca el contenedor
# 2. Apuntar .env.local a la DB local (ver .env.example)
#    DATABASE_URL=postgres://momentum:momentum@localhost:5432/momentum
npm run db:migrate:local   # aplica las 4 migraciones → crea todas las tablas
# 3. Opcional: cargar datos de prueba
npm run db:seed:demo       # seed con data de ejemplo
```

No hace falta `db:baseline` en este flujo: la DB arranca vacía y `migrate()` crea `drizzle.__drizzle_migrations` por su cuenta aplicando cada migración desde cero.

### Ciclo diario

```bash
npm run db:up     # si el contenedor no está corriendo (persiste entre reinicios si no se bajó con -v)
npm run dev       # el app levanta contra la DB local
```

### Reset total (borrar toda la data local)

```bash
npm run db:down:volume    # baja el contenedor Y borra el volumen
npm run db:up             # recrea el contenedor con DB vacía
npm run db:migrate:local  # vuelve a aplicar el schema
```

### Apuntar temporalmente a prod (Railway) para debug

1. Editar `.env.local`: cambiar `DATABASE_URL` a la URL de Railway
2. Hacer lo que sea necesario
3. **Volver a la URL local antes de correr seeds, resets, o cualquier mutación**

⚠️ Riesgo real: cualquier `npm run db:seed:*`, `db:reset`, o migración mal aplicada contra Railway afecta la DB de producción. La URL local es el default; Railway es opt-in explícito.

### .env.local — qué poner

```bash
# DB local (Docker) — DEFAULT para desarrollo
DATABASE_URL=postgres://momentum:momentum@localhost:5432/momentum

# Si necesitás debuggear contra Railway prod, reemplazás esto temporalmente
# con la URL de Railway → Variables → DATABASE_URL
```

El archivo `docker-compose.dev.yml` está en la raíz del repo. No afecta Vercel ni Railway en ningún deploy.

---

## Tests

**Vitest** — elegido por liviano (sin dependencia de un test DB real para la mayoría de los casos) y porque
es el estándar de facto para proyectos Vite/Next modernos. Los tests viven junto al código (`*.test.ts`),
no en una carpeta `__tests__/` separada.

```bash
npm test          # corre toda la suite una vez (vitest run)
npm run test:watch  # watch mode para desarrollo
```

**Filosofía:** no hay cobertura exhaustiva — esta es una app personal y `CLAUDE.md` ya dice "no agregar
tests por agregar". Los tests existentes cubren los flujos donde un bug es caro: dinero (billing) y acceso
(auth/admin). Si agregás un nuevo flujo de ese tipo, agregale tests; si es un CRUD más de un pilar, no.

**Cómo están mockeados (sin Postgres real):**
- `test/stubs/db-mock.ts` — reemplazo de `@/lib/db` con un mock encadenable+then-able. Cada llamada a
  `db.select()/insert()/update()/delete()` devuelve una nueva "chain" que resuelve al próximo resultado
  encolado con `queueResult([...])`, en el mismo orden en que el código bajo test las dispara. Usar
  `resetDbMock()` en `beforeEach`.
  ```ts
  vi.mock('@/lib/db', () => import('../test/stubs/db-mock'));
  import { queueResult, resetDbMock } from '../test/stubs/db-mock';
  beforeEach(() => resetDbMock());
  queueResult([{ id: '1', active: true }]); // resultado de la próxima query
  ```
- `'server-only'` está aliaseado a un stub vacío en `vitest.config.ts` (Next lo no-opea en su bundler;
  Vite/vitest no lo conoce, así que sin el alias cualquier `lib/*.ts` con `import 'server-only'` rompe al
  importarse en un test).
- Variables/funciones referenciadas dentro de un factory de `vi.mock(...)` que no sean otro `import(...)`
  dinámico deben pasar por `vi.hoisted(() => ({...}))` — `vi.mock` se hoistea por encima de todo el resto
  del archivo, así que un `const` normal declarado más abajo todavía no existe cuando el factory corre.

**Qué está cubierto:**
| Archivo | Qué testea |
|---------|-----------|
| `lib/auth.test.ts` | HMAC sign/verify de la cookie de sesión (roundtrip, tamper, secret distinto), `requireUser` (usuario inactivo, sesión invalidada por `invalidate_sessions_before`), `requireAdmin` (rechaza member) |
| `lib/limits.test.ts` | `checkLimit` — self-host siempre unlimited sin tocar la DB; hosted con plan free bajo/al/sobre el límite; plan pro unlimited |
| `lib/polar-webhook.test.ts` | `resolvePolarEvent` — el mapeo evento→plan de Polar completo (todas las transiciones de `subscription.updated`, `revoked`→free, `order.paid`→pro, eventos no manejados→null) |
| `app/admin/actions.test.ts` | guard de auto-lockout en `setUserActive`/`setUserRole` — un admin no puede desactivarse ni quitarse el rol a sí mismo |

**Billing es dinero real — `lib/polar-webhook.ts` extrae el switch evento→estado de
`app/api/webhooks/polar/route.ts` a una función pura (`resolvePolarEvent`) específicamente para que sea
testeable sin mockear el SDK de Polar ni la DB.** Si tocás el mapeo de eventos de Polar, tocás ese archivo
y sus tests — no reinsertes el switch inline en la route.

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

## Plans & limits (freemium)

`MOMENTUM_MODE` distingue self-host (default, sin límites) de hosted (multi-tenant, límites freemium activos):

- `self_hosted` (default, incluye `undefined`) — `checkLimit()` siempre devuelve `allowed: true` (unlimited). El self-host nunca tiene límites.
- `hosted` — los límites de `lib/plans.ts:PLAN_LIMITS` se aplican según `user.plan` (`free` | `pro`). `pro` = `null` en todos los recursos = unlimited.

**Para cambiar un número de límite:** editar `PLAN_LIMITS.free` en `lib/plans.ts` — nada más necesita cambiar.

**Dónde está enforced:**
- Server actions de creación (`app/<pilar>/actions.ts`) — llaman `checkLimit(user.id, resource)` antes del insert; si `allowed: false` devuelven `LimitReachedError` que la UI muestra como mensaje de límite alcanzado.
- `/api/v1/import/*` — cada endpoint chequea el límite una vez, calcula `remaining`, e importa hasta ese tope; los items que exceden el límite se reportan en `errors[]` con `error: "plan limit reached (...)"` (no abortan el resto del import).
- `/settings/profile` — `PlanSection` (`components/settings/PlanSection.tsx`) muestra uso actual vs límite por recurso via `getUsageSummary()`.

---

## Billing — Polar (Merchant of Record)

Polar (polar.sh) actúa como Merchant of Record — cobra, gestiona IVA/impuestos, y envía webhooks que son la única fuente de verdad del plan del usuario.

**Aplica solo en `MOMENTUM_MODE=hosted`.** Self-hosters dejan todas las vars `POLAR_*` sin setear; `isPolarConfigured()` devuelve `false`, ningún cliente Polar se construye, el webhook route devuelve 404.

### Flujo de plan

```
Checkout Polar → webhook → users.plan / users.plan_status → checkLimit()
```

`users.plan` (`free` | `pro`) + `users.plan_status` (`active` | `past_due` | `cancelled`) son la fuente de verdad local. `checkLimit()` en `lib/limits.ts` los lee; en `self_hosted` siempre devuelve `{ allowed: true }`.

### Event → State mapping (webhooks)

| Evento Polar | `plan` | `plan_status` | Notas |
|---|---|---|---|
| `subscription.created` | `pro` | `active` | Sub nueva creada |
| `subscription.active` | `pro` | `active` | Sub activa (nueva o pago recuperado) |
| `subscription.updated` con `status=active/trialing` | `pro` | `active` | Cambio de estado → activo |
| `subscription.updated` con `status=past_due` | `pro` | `past_due` | Cambio de estado → vencido |
| `subscription.updated` con `status=canceled` | `pro` | `cancelled` | Cambio de estado → cancelado |
| `subscription.updated` con `status=incomplete/unpaid` | _(sin cambio)_ | _(sin cambio)_ | Estados transitorios — ignorados |
| `subscription.canceled` | `pro` | `cancelled` | Cancelación solicitada; acceso hasta fin del período |
| `subscription.past_due` | `pro` | `past_due` | Pago fallando, reintentando |
| `subscription.revoked` | **`free`** | `active` | **Único downgrade** — período terminó o reintentos agotados |
| `order.paid` | `pro` | `active` | Señal de activación fallback; solo upgrade, nunca downgrade |
| cualquier otro | _(sin cambio)_ | _(sin cambio)_ | Ignorado, 200 acked |

### Archivos clave de billing

| Archivo | Rol |
|---------|-----|
| `lib/polar.ts` | Client Polar (lazy), `isPolarConfigured()`, `getSiteUrl()` |
| `app/settings/billing/actions.ts` | `createCheckoutSession()` + `openCustomerPortal()` |
| `app/api/webhooks/polar/route.ts` | Webhook handler — firma, switch de eventos, update DB |
| `components/settings/UpgradeButton.tsx` | Botón upgrade para plan `free` |
| `components/settings/ManageBillingButton.tsx` | Botón portal para plan `pro` |
| `components/settings/PlanSection.tsx` | Renderiza plan/status/uso + botones según estado |

### Setup en Polar (sandbox primero)

1. Crear organización en `https://sandbox.polar.sh`
2. Crear producto recurrente "Pro" → copiar el Product ID → `POLAR_PRO_PRODUCT_ID`
3. Crear Organization Access Token → `POLAR_ACCESS_TOKEN`
4. En Webhooks, crear endpoint apuntando a `<NEXT_PUBLIC_SITE_URL>/api/webhooks/polar`, suscribir a `subscription.*` y `order.paid` → copiar el secret → `POLAR_WEBHOOK_SECRET`
5. Setear `POLAR_SERVER=sandbox` (default) o `production` para prod

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

### Rate limiting

Los 6 endpoints `/api/v1/import/*` tienen rate limiting por token (no por IP — todos ya requieren un Bearer
token válido antes de hacer nada, así que el token es la unidad correcta de throttling).

**Para ajustar los límites:** un solo lugar, `lib/rate-limits.ts` → `API_IMPORT_RATE_LIMIT`. Dos perfiles:

```ts
export const API_IMPORT_RATE_LIMIT = {
  hosted:      { windowMinutes: 1, maxRequests: 10 },
  self_hosted: { windowMinutes: 1, maxRequests: 60 },
};
```

**Por qué hosted es más estricto que self-host** (a diferencia de los plan limits de `lib/plans.ts`, que en
self-host son siempre `null`/unlimited): los plan limits existen para monetización — no tiene sentido
capar tus propios recursos en tu propio server. El rate limit es distinto: protege contra abuso/sobrecarga,
no contra dar producto gratis. En hosted la DB es compartida entre tenants — un token filtrado o un bug de
script de un usuario puede degradar el servicio para todos los demás, así que el límite es bajo. En
self-host el único riesgo real es tu propio script en loop infinito pegándole a tu propio Postgres — vale
la pena un límite, pero uno mucho más laxo (6x). Si te molesta en un import grande legítimo, subí el número
de `self_hosted` en ese archivo — no hace falta tocar nada más.

**Presupuesto compartido entre los 6 endpoints, no por endpoint.** Un token que reparte requests entre
`/import/workblocks`, `/import/build`, etc. no debería tener más presupuesto combinado que uno que le pega
todo a un solo endpoint — todos tocan la misma DB.

**Implementación:** `lib/api-rate-limit.ts:enforceApiRateLimit(tokenId, route)` — sliding window sobre la
tabla `api_rate_limit_hits` (mismo patrón que `login_attempts`: contar hits recientes, insertar uno nuevo si
hay budget, limpiar filas viejas oportunísticamente). Tira `ApiAuthError(429)` con `retryAfter` en segundos
si se excede; cada route ya lo maneja en su `catch` existente sin código adicional (`ApiAuthError` ahora
acepta status `429` además de `401`/`403`).

**Agregar rate limiting a un endpoint nuevo:** llamar `enforceApiRateLimit(tokenId, '<nombre-ruta>')` justo
después de `requireApiToken(...)`, dentro del mismo `try`. El `catch` existente ya sabe mostrar el 429.

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

## Database backups

`.github/workflows/db-backup.yml` corre **daily a las 03:00 UTC** (+ `workflow_dispatch` para correrlo a
mano). Hace `pg_dump` de la DB de Railway, **verifica el restore en CI** (lo restaura contra un Postgres
descartable antes de confiar en el backup), lo encripta, y lo sube como artifact de GitHub Actions.

**Por qué encriptado:** este repo es **público** — los artifacts de GitHub Actions en repos públicos son
descargables por cualquiera con la run URL, sin necesitar acceso de escritura al repo. El dump tiene datos
reales (emails, password hashes, campos de billing de Polar), así que nunca se sube sin encriptar.

### Setup (una sola vez)

En GitHub → repo → Settings → Secrets and variables → Actions, agregar:

| Secret | Valor |
|--------|-------|
| `DATABASE_URL` | la misma connection string pública de Railway que usa Vercel |
| `BACKUP_ENCRYPTION_KEY` | passphrase random — generar con `openssl rand -base64 32` |

**Guardar `BACKUP_ENCRYPTION_KEY` en un password manager.** Sin esa key, los backups encriptados son
irrecuperables — no hay "olvidé la key, recupérenla" posible.

Si `DATABASE_URL` no está seteada (ej. un fork self-host que no quiere este workflow), el job hace skip
limpio sin fallar. Si falta `BACKUP_ENCRYPTION_KEY` pero sí está `DATABASE_URL`, el job **falla fuerte**
(nunca sube un dump sin encriptar).

### Restore drill — contra el Postgres local de Docker

**No hace falta tener `pg_dump`/`pg_restore` instalados.** Todo este repo (y el workflow de backup) los
corre vía Docker (`postgres:16-alpine`), así que el drill de restore usa el mismo approach — solo necesitás
Docker Desktop corriendo. Esto es exactamente lo que se validó al construir el workflow.

**0. Prerequisito — DB local arriba y vacía/descartable:**

```bash
npm run db:up   # si el contenedor local no está corriendo (ver "Local dev database" arriba)
```

Las credenciales del Postgres local son `postgres://momentum:momentum@localhost:5432/momentum` (ya
documentadas arriba — no son secretas, son fijas para dev).

**1. Descargar el artifact:**

- GitHub → repo → Actions → la run de `DB Backup` que quieras → al final de la página, sección
  "Artifacts" → descargar `db-backup-<fecha>.zip` → descomprimir, te queda `backup-<fecha>.dump.enc`.
- O con `gh` CLI si lo tenés instalado: `gh run download <run-id> -n db-backup-<fecha>`.

**2. Desencriptar** (necesitás el valor de `BACKUP_ENCRYPTION_KEY` — está en GitHub → repo → Settings →
Secrets and variables → Actions, pero los secrets no se pueden leer una vez seteados; tiene que venir de
donde lo guardaste — password manager):

```bash
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in backup-<fecha>.dump.enc \
  -out backup.dump \
  -pass pass:'<pegar BACKUP_ENCRYPTION_KEY acá>'
```

Si la passphrase está mal, `openssl` tira `bad decrypt` — no genera un archivo corrupto silenciosamente.

**3. Restaurar contra la DB local (vía Docker, sin instalar nada):**

En **Windows / Git Bash**, prefijar los comandos `docker cp` y `docker exec` con `MSYS_NO_PATHCONV=1` —
sin eso, Git Bash traduce `/tmp/backup.dump` a un path de Windows y el contenedor no encuentra el archivo
(`pg_restore: error: could not open input file`). En macOS/Linux esto no hace falta, es un no-op ahí.

```bash
# Copiar el dump a un contenedor temporal con el cliente pg_restore (evita el quirk de paths
# Windows/Git-Bash con volume mounts — usar docker cp en vez de -v)
docker create --name pgrestore-tmp --network host postgres:16-alpine sleep 60
docker start pgrestore-tmp
MSYS_NO_PATHCONV=1 docker cp backup.dump pgrestore-tmp:/tmp/backup.dump

# Restaurar — contra la DB local vacía, sin --clean (no hay nada que limpiar)
MSYS_NO_PATHCONV=1 docker exec pgrestore-tmp pg_restore --no-owner --no-privileges \
  -d postgresql://momentum:momentum@localhost:5432/momentum \
  /tmp/backup.dump

docker rm -f pgrestore-tmp
```

Verificado end-to-end armando este runbook (dump real → cp → restore → query) — `MSYS_NO_PATHCONV=1` es lo
que lo destraba en este entorno.

**4. Verificar que el restore sirvió de algo real** (no solo "no tiró error" — confirmar que hay data):

```bash
docker run --rm --network host postgres:16-alpine \
  psql postgresql://momentum:momentum@localhost:5432/momentum \
  -c "select count(*) from users;" \
  -c "select count(*) from workblocks;"
```

Si esos counts coinciden con lo que esperás de prod al momento del backup, el restore es bueno. Si el
restore falla en el paso 3, **el backup no sirve** — no asumas que está bien solo porque se subió (aunque
el workflow ya lo verificó en CI antes de subirlo, repetir el drill localmente de vez en cuando confirma
que el procedimiento documentado — no solo el de CI — sigue funcionando).

**5. Reset antes de repetir el drill** (la DB local queda con los datos del dump restaurado):

```bash
npm run db:down:volume   # borra todo, contenedor + volumen
npm run db:up
npm run db:migrate:local # vuelve a crear el schema vacío
```

### Restore real contra prod (recovery — perdiste la DB de Railway)

Mismos pasos 1-2 (descargar + desencriptar). Para el paso 3, contra una DB de Railway:

- **DB nueva/vacía** (Railway recién provisionado): mismo comando del paso 3 arriba, pero con
  `-d "$DATABASE_URL"` apuntando a Railway en vez de `localhost`.
- **DB existente que se quiere sobreescribir** (ya tiene schema, querés pisarlo): agregar
  `--clean --if-exists` al `pg_restore` para que dropee los objetos existentes antes de recrearlos.

**Practicá el drill local (pasos 0-5) antes de necesitarlo de verdad contra prod** — un restore que nunca
corriste fuera de CI no es un backup confiable, es una esperanza.

El paso "Verify restore into scratch DB" del workflow ya hace este mismo restore (contra un Postgres
descartable, no local) en cada corrida — si esa verificación falla, el job falla y no sube el backup, así
que un backup que llegó a subirse ya pasó por un restore real al menos una vez en CI. El drill de arriba es
para verificarlo *vos* localmente, no solo confiar en que CI lo hizo.

### Retención

Artifacts se retienen 30 días (`retention-days` en el workflow — ajustable ahí). Backups más viejos los
borra GitHub automáticamente, no hace falta limpieza manual.

---

## Environment variables

| Var | Para qué | Requerido | Ejemplo |
|-----|----------|-----------|---------|
| `DATABASE_URL` | Conn string a Railway Postgres | siempre | `postgres://user:pass@host:port/db` |
| `SESSION_SECRET` | HMAC secret para firmar cookies | siempre | (32 bytes hex) |
| `NEXT_PUBLIC_SITE_URL` | URL base para logout redirect | opcional | `http://localhost:3000` |
| `CRON_SECRET` | Bearer token para cron de Vercel | prod | (string random) |
| `ALLOW_SIGNUP` | Habilitar ruta `/signup` | opcional | `true` / `false` |
| `MOMENTUM_MODE` | `self_hosted` (default, unlimited) o `hosted` (activa límites freemium) | opcional | `hosted` |
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
- ❌ **No tocar el vault de Obsidian** (`C:\Users\rober\rober's-workspace\`) desde este repo. Son codebases separadas.
- ❌ **No agregar caching agresivo.** Toda la data es del usuario, `force-dynamic` es correcto.
- ❌ **No usar `'use client'` por default.** Empezá server, escalá a client solo si hay interactividad real.
- ❌ **No crear un cliente Supabase ni replicar el patrón viejo.** Drizzle es la única vía a la DB.
- ❌ **No agregar shadcn.** El stack usa `@base-ui/react` + primitives custom — mantener consistencia con `components/ui/`.
- ❌ **No hardcodear strings de UI en componentes.** Usar `t(key, lang)` de `lib/strings.ts`.

---

## Conexión con el vault de Obsidian

Esta app es la **capa operacional diaria**. El vault es la **capa de conocimiento de largo plazo**.

- **Project node:** `C:\Users\rober\rober's-workspace\10-projects\momentum\momentum.md` (este repo lo referencia para tracking de sesiones — el path real del vault usa guion, no espacio; ojo con el typo)
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
4. `npx drizzle-kit generate --name add_<columna>_to_workblocks` y commitear la migración generada
   (`npx drizzle-kit push` solo si estás iterando rápido en local y vas a generar la migración después)
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
4. Commitear y `git push` — Vercel aplica la migración en el siguiente deploy (`db:migrate`).
   Self-host: `npm run db:migrate:local`.

---

## Referencias externas

- `C:\Users\rober\rober's-workspace\80-wiki\concepts\claude-code-best-practices.md` — best practices de Claude Code
- `C:\Users\rober\rober's-workspace\80-wiki\concepts\agentic-engineering.md` — principios de ingeniería agéntica
- `C:\Users\rober\rober's-workspace\80-wiki\concepts\context-bloat.md` — por qué este CLAUDE.md está acotado a 15 hard rules
- `C:\Users\rober\WEB_WORKSPACE\CLAUDE.md` — overview del workspace
- `C:\Users\rober\WEB_WORKSPACE\portfolio-robertino\` — referencia del frontend stack (motion v12, base-ui, tokens OKLCH)
- `C:\Users\rober\WEB_WORKSPACE\lanza\` — referencia inicial del setup Clerk + Supabase (ahora deprecado en este proyecto, mantener como histórico)
