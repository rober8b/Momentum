# MIGRATION_PLAN.md — command-center: de personal tool a self-hostable multi-user

> **Scope:** Convertir la app single-user (HMAC cookie + APP_PASSWORD) en una app
> open-source self-hostable que soporte múltiples usuarios en una instancia.
> Target: usuarios técnicos que se la clonen y levanten ellos mismos.
> **NO es SaaS multi-tenant.** Es personal tool multi-account.

---

## Sección B — Decisiones que necesito que me confirmes primero

> Empiezo por acá porque estas decisiones afectan la forma de toda la Fase 1.
> Una vez que las confirmes, el inventario de la Sección A ya tiene respuestas concretas.

---

### B1. Sessions: HMAC cookie vs DB sessions vs JWT

**Estado actual:** HMAC cookie stateless. La cookie lleva `ok.<hmac>`, sin user ID.
En multi-user necesitamos saber *quién* está autenticado, no solo *si* está autenticado.

**Opción A — HMAC cookie con user_id embebido (recomendada)**
- Cookie lleva `userId.<hmac(userId)>` en vez de `ok.<hmac(ok)>`
- Sin cambio de librería, misma lógica de verificación
- Stateless: no requiere tabla de sesiones ni lookup a DB por request
- Contra: no podés invalidar sesiones individuales sin rotar `SESSION_SECRET` (que invalida *todas*)
- Mitigación: cookie expira en 30 días, alcanza para uso personal

**Opción B — Sessions en DB**
- Nueva tabla `sessions(id, user_id, expires_at, user_agent, ip_hash)`
- Cookie lleva el `session_id`; proxy hace lookup a DB para verificar
- Permite logout real ("revocar sesión"), ver sesiones activas, invalidar una sola
- Contra: agrega ~1 query por request en el proxy (Edge runtime + DB = latencia)
- El proxy ya tiene una fuga potencial: corre en Edge con `postgres-js` que es Node-only

**Opción C — JWT (no recomendada)**
- Añade librería, más complejidad de rotación de keys, zero ventajas sobre Opción A para este caso

**Recomendación:** Opción A para empezar. Si en el futuro alguien reporta que necesita
invalidar sesiones, se puede migrar a Opción B en un PR independiente. El costo de
implementación de A es mucho menor y el riesgo de seguridad de no poder revocar
sesiones individuales es bajo en una instancia personal self-hosted.

**¿Tu decisión?** [ ] A (HMAC con user_id) / [ ] B (DB sessions) / [ ] C (JWT)

---

### B2. Registro: abierto vs setup wizard (primer user) vs invite-only

**Opción A — Setup wizard "first run" (recomendada)**
- Si no hay usuarios en la DB, redirige a `/setup` (público)
- Página de setup crea el primer usuario (admin)
- Después del setup, `/setup` queda bloqueado para siempre (o solo accesible desde panel admin)
- No hay signup público: para agregar más usuarios, el admin lo hace desde un panel de admin

**Opción B — Registro abierto**
- Cualquiera que llegue a la URL puede crearse cuenta
- Problemático para self-hosting: si alguien descubre la URL, puede registrarse
- Requiere rate limiting y captcha para ser seguro

**Opción C — Solo env var**
- `ADMIN_EMAIL` + `ADMIN_PASSWORD` en env, sin tabla de users
- No escala a múltiples usuarios

**Recomendación:** Opción A. Setup wizard la primera vez, luego admin puede crear invitaciones
o agregar usuarios manualmente desde `/settings`. Consistente con cómo lo hacen Gitea,
Umami, Plausible y otros self-hosted tools. Opcionalmente, env var `ALLOW_REGISTRATION=true`
para quienes quieran abrirlo.

**¿Tu decisión?** [ ] A (setup wizard) / [ ] B (registro abierto con guards) / [ ] C (env var)

---

### B3. Timezone: hardcodeado vs setting de usuario

**Estado actual:** `const TZ = 'America/Argentina/Buenos_Aires'` en `lib/date.ts`.

**Opción A — Setting de usuario en DB (recomendada)**
- `users.settings` jsonb incluye `{ timezone: string }`
- Default: `'UTC'`
- En `lib/date.ts`, las funciones reciben `tz?: string` con fallback a `'UTC'`
- El user lo configura en `/settings`

**Opción B — Env var global**
- `APP_TIMEZONE=America/Argentina/Buenos_Aires`
- Toda la instancia usa la misma timezone
- Más simple, suficiente si la instancia es para una familia/equipo en el mismo huso horario

**Opción C — Híbrida (Opción B como default, Opción A como override por user)**
- La más correcta a largo plazo, la más cara de implementar

**Recomendación:** Opción B como punto de partida. Convierte el hardcodeo en env var.
Si después alguien pide per-user timezone, se puede agregar sin romper nada.

**¿Tu decisión?** [ ] A (per-user) / [ ] B (env var global) / [ ] C (híbrida)

---

### B4. i18n: full (next-intl) vs lite (dict de strings)

**Estado actual:** Todo hardcodeado en español argentino, en los componentes directamente.

**Opción A — next-intl (no recomendada para v1)**
- Excelente librería, pero requiere extraer *todos* los strings a archivos de mensajes
- La app tiene ~200+ strings en componentes, pages, actions
- Costo: 2-3 días de trabajo para un refactor correcto
- Beneficio: i18n "real" con plurales, interpolaciones, lazy loading

**Opción B — Dict estático ES/EN (recomendada)**
- `lib/i18n.ts`: export de un objeto `{ es: {...}, en: {...} }`
- Hook `useLocale()` que lee `locale` de `users.settings`
- Los strings en componentes reemplazan literales por `t('key')`
- Costo: 1 día. Los componentes ya están encapsulados
- Contra: no soporta plurales fácilmente, strings largos son awkward

**Opción C — Solo documentación**
- Dejar la app en español, documentar cómo forkearla para cambiar idioma
- Costo cero de implementación
- Válido si el target son usuarios que van a leer código de todas formas

**Recomendación:** Opción C en Fase 2, con un extracto del dict en un solo archivo.
Alguien que fork-ea y cambia idioma puede editar un archivo. El refactor completo
de i18n es un rabbit hole que no aporta valor hasta tener más usuarios.

**¿Tu decisión?** [ ] A (next-intl) / [ ] B (dict estático) / [ ] C (un archivo de strings)

---

### B5. Demo data: seed incluido vs separado

**Opción A — Script de seed separado `scripts/seed-demo.ts`**
- `npm run db:seed` crea datos de ejemplo (anónimos, sin nada tuyo)
- Env var `SEED_DEMO_DATA=true` lo corre automáticamente en el setup wizard
- Datos de demo: materias ficticias, workblocks de ejemplo, etc.
- Recomendada

**Opción B — Demo mode en memoria sin DB**
- Demasiado trabajo, fuera de scope

**Recomendación:** Opción A. El seed es útil para testear que un deploy funciona y
para que nuevos usuarios entiendan la app antes de limpiar y cargar su data.

**¿Tu decisión?** [ ] A (seed script) / [ ] skip (no seed por ahora)

---

### B6. Rate limiting

**Estado actual:** Sin rate limiting.

**Opción A — En proxy.ts con contador en memoria (no recomendada)**
- Edge runtime no tiene estado persistente entre instancias
- El contador se resetea en cada cold start → inútil

**Opción B — Upstash Redis + @upstash/ratelimit**
- Dep externa, requiere cuenta Upstash
- Overhead para una instancia personal

**Opción C — Rate limiting delegado a Vercel/Nginx (recomendada)**
- En Vercel: DDoS protection gratuita, rate limiting en Pro
- En self-hosted con Nginx: configuración en el proxy reverso
- La app no maneja rate limiting internamente
- Para el login form: brute force mitigado con `setTimeout(1000)` en el action

**Recomendación:** Opción C. Agregar un `await new Promise(r => setTimeout(r, 500))`
en `loginAction` cuando la password falla (hace brute force más lento sin dependencias).
El rate limiting real es responsabilidad del infra layer.

**¿Tu decisión?** [ ] B (Upstash) / [ ] C (infra layer + login delay)

---

### B7. Vault export en multi-user

**Estado actual:** El export escribe a paths hardcodeados del vault de Rober
(`30-personal/work/aleph/...`, `20-studies/ucema/...`).

En multi-user, ¿qué pasa con el export?

**Opción A — Export deshabilitado para otros usuarios**
- La feature es demasiado personal (vault paths, slugs de Obsidian)
- Ocultar el ExportButton si `user.role !== 'admin'` o si no está configurado
- Recommended para v1

**Opción B — Export configurable por usuario**
- `users.settings` incluye vault config (paths base, estructura)
- Setup wizard pregunta si querés configurar el export
- Más trabajo, más valor a largo plazo

**Recomendación:** Opción A para Fase 1-2. El export es una feature power-user muy
específica. Documentarla bien en el README y dejarla configurable en Fase 3.

**¿Tu decisión?** [ ] A (solo admin/configurado) / [ ] B (configurable por user)

---

## Sección A — Inventario de cambios

> Nota: algunas respuestas dependen de las decisiones de Sección B.
> Asumo las opciones recomendadas donde es necesario.

---

### A1. Auth multi-user

#### Archivo nuevo: `lib/auth.ts` (reescritura)

**Cambios:**
- `requireRober(): Promise<void>` → `requireUser(): Promise<{ id: string; email: string; role: string }>`
  - El return value permite a los server components saber quién es el user sin segundo query
- `signSession(userId: string): string` — embebe el userId en el payload firmado
- `verifySession(signed: string): string | null` — retorna userId o null (en vez de boolean)
- `passwordMatches()` → eliminada (la verificación pasa a comparar hash de argon2id en la action)
- `isAuthed()` → eliminada (reemplazada por `requireUser()`)
- Nueva: `hashPassword(plain: string): Promise<string>` — argon2id
- Nueva: `verifyPassword(plain: string, hash: string): Promise<string>` — timing-safe

**Dependencia nueva:** `argon2` (Node native binding, no web-compatible).
Alternativa si argon2 da problemas en Edge/Vercel: `@node-rs/bcrypt` o `bcryptjs`.
**Recomendación:** usar `bcryptjs` (puro JS, zero native deps, funciona en todos los runtimes Vercel).
bcrypt es más lento que argon2id para el mismo costo pero bien configurado (rounds=12) es suficiente.

**Cookie format nuevo:** `{userId}.{hmac(userId)}`
- `userId` es el UUID del user
- `hmac` se calcula igual que hoy (SHA-256 + base64url)
- Mismo `SESSION_SECRET`, mismo `COOKIE_NAME`

#### Archivo nuevo: `proxy.ts` (cambios mínimos)

**Cambios:**
- `COOKIE_PAYLOAD = 'ok'` → extraer el payload dinámicamente
- `verifySession(signed, secret)` → `extractUserId(signed, secret): string | null`
- Si el user no existe → redirigir a `/login`
- Nueva ruta pública: `/setup` (solo si no hay usuarios en DB — esto **no** se puede verificar en Edge sin DB; solución: env var `SETUP_COMPLETE=true` que se setea automáticamente tras el setup)
- Alternativa más simple: el setup wizard es una ruta `/setup` que verifica en el server component si hay users, sin tocar proxy.ts

**Recomendación:** No tocar la lógica de verificación en proxy.ts más allá de lo mínimo.
El proxy solo verifica que haya una cookie válida y pasa. El server component o action
hace el lookup del user a DB.

#### Archivo nuevo: `app/login/page.tsx` y `app/login/actions.ts`

**Cambios:**
- Login form: agrega campo `email` además de `password`
- `loginAction`: busca user por email, verifica password hash con bcrypt
- Si no hay usuarios en DB, redirigir a `/setup` en vez de mostrar login

#### Archivo nuevo: `app/setup/page.tsx` + `app/setup/actions.ts`

**Nuevo:**
- Página pública de primer setup: formulario `email + password + confirm`
- Server component verifica que `users` table está vacía (si no, redirige a `/`)
- `setupAction`: crea el primer user con role `'admin'`, redirige a `/`
- Opcionalmente: si `SEED_DEMO_DATA=true`, corre seed tras crear el user

#### Archivo: `app/settings/page.tsx` (nuevo)

- Panel de usuario: cambiar password, timezone, preferencias
- Si role === 'admin': lista de usuarios, crear/desactivar usuarios

#### Todos los archivos de actions (`app/*/actions.ts`) — 8 archivos

**Cambio en cada uno:**
- `await requireRober()` → `const user = await requireUser()`
- Cada mutación agrega `user_id: user.id` al insert/update
- Cada query agrega `.where(eq(schema.x.user_id, user.id))` para aislar datos

**Archivos afectados:**
- `app/uni/actions.ts`
- `app/work/actions.ts`
- `app/build/actions.ts`
- `app/freelance/actions.ts`
- `app/projects/actions.ts`
- `app/community/actions.ts`
- `app/search/actions.ts`
- `app/api/export/route.ts`

#### Todos los server components (pages) — ~12 archivos

**Cambio en cada uno:**
- `await requireRober()` → `const user = await requireUser()`
- Queries filtradas por `user_id`

---

### A2. Schema migration

#### Nueva tabla: `users`

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member', -- 'admin' | 'member'
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX users_email_idx ON users(email);
```

`settings` jsonb estructura inicial:
```json
{
  "timezone": "UTC",
  "locale": "es",
  "theme": "dark"
}
```

#### FK `user_id` en todas las tablas

**Tablas que necesitan `user_id`:**

| Tabla | Cambio |
|-------|--------|
| `subjects` | `user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL` |
| `assignments` | ídem |
| `workblocks` | ídem |
| `build_items` | ídem |
| `freelance_clients` | ídem |
| `freelance_tasks` | No directamente — hereda del client. Pero para search cross-client necesita su propio `user_id` |
| `own_projects` | ídem |
| `community_items` | ídem |
| `vault_exports` | ídem |

**Nota sobre `freelance_tasks`:** La tarea FK a `freelance_clients`, y el client tiene `user_id`.
Técnicamente el user_id se puede inferir via JOIN. Pero para performance en queries directas
(Today view, search) vale la pena desnormalizar y poner `user_id` directo también.

#### Índices compuestos

Reemplazar índices simples por compuestos `(user_id, <campo>)` donde hay queries frecuentes:

```sql
-- Reemplazar:
INDEX assignments_status_idx ON assignments(status)
-- Por:
INDEX assignments_user_status_idx ON assignments(user_id, status)
INDEX assignments_user_due_idx ON assignments(user_id, due_date)

-- Workblocks
INDEX workblocks_user_status_idx ON workblocks(user_id, status)
INDEX workblocks_user_position_idx ON workblocks(user_id, status, position)

-- Build items
INDEX build_items_user_status_idx ON build_items(user_id, status)

-- Freelance
INDEX freelance_clients_user_status_idx ON freelance_clients(user_id, status)
INDEX freelance_tasks_user_status_idx ON freelance_tasks(user_id, status)

-- Otros
INDEX own_projects_user_status_idx ON own_projects(user_id, status)
INDEX community_items_user_status_idx ON community_items(user_id, status)
```

#### Migración de datos — instancia personal

Opción A (recomendada): **Migración manual asistida por script**
1. Crear el user de Rober con el mismo email/password via setup wizard antes de correr la migración
2. Correr `drizzle-kit generate` para el schema nuevo
3. Script de migración: `UPDATE <tabla> SET user_id = '<rober-uuid>' WHERE user_id IS NULL`
4. Agregar NOT NULL constraint después

Esto preserva todos los datos existentes y los asigna al usuario admin.

El repo público arranca de cero (tabla `users` vacía → setup wizard).

---

### A3. Hardcodeo a parametrizar

#### Críticos (bloquean multi-user)

| Hardcodeo | Archivo | Línea | Solución |
|-----------|---------|-------|----------|
| `const TZ = 'America/Argentina/Buenos_Aires'` | `lib/date.ts` | 3 | Env var `APP_TIMEZONE`, default `'UTC'` |
| `client: 'aleph'` default en workblocks | `lib/db/schema.ts` | 74 | Default `''` (string vacío), UI pregunta |
| `CommunityOrg = 'ai-consensus' \| 'levellers' \| 'xplora' \| 'other'` | `lib/types.ts` | 147 | El enum `other` siempre existe; las orgs específicas se vuelven texto libre con el campo `organization: text`. Se dropea el enum. |
| `requireRober()` | 20+ archivos | — | `requireUser()` |

#### Moderados (bloquean open source clean)

| Hardcodeo | Archivo | Solución |
|-----------|---------|----------|
| `'aleph'` en vault export | `lib/vault-export.ts` | `client` field del workblock (ya existe en el schema) |
| `'ucema'` en vault export paths | `lib/vault-export.ts` | Configurable en `users.settings.vault_studies_path` |
| `'30-personal/...'` paths | `lib/vault-export.ts` | `users.settings.vault_work_path`, etc. |
| `tags: '[trabajo, aleph, weekly]'` | `lib/vault-export.ts` | Configurable o gen dinámicamente |
| `[[10-projects/aleph/aleph\|Aleph]]` | `lib/vault-export.ts` | Eliminar el wikilink hardcodeado |
| `[[x-growth-builder]]` | `lib/vault-export.ts` | Eliminar |
| `'es-AR'` locale en `formatDate` | `lib/date.ts` | Leer de user settings |

#### Cosméticos (no bloquean, limpiar antes de hacer público el repo)

| Hardcodeo | Archivo | Solución |
|-----------|---------|----------|
| `// Drizzle schema — espejo del SQL en supabase/schema.sql` | `lib/db/schema.ts` | Actualizar comment |
| `// Shared types — espejo del schema de Supabase` | `lib/types.ts` | Actualizar comment |
| `'Rober'` en error messages | `lib/auth.ts` | Sin mención explícita, pero check |
| `'roberb'` | GitHub URLs, CLAUDE.md | Solo en docs, ok |
| Colores de orgs hardcodeados en `CommunityForm` | community components | Hacer dinámico con `organization` libre |
| `platforms: ['x', 'linkedin']` default | `lib/db/schema.ts` | Default razonable, mantener |
| `semester: text('semester')` | schema | Podría ser más genérico (`period`, `semester`, `term`) — cambio cosmético, bajo valor |

#### BuildType enum

```ts
export type BuildType = 'hackathon' | 'project' | 'opinion' | 'news' | 'portfolio-update' | 'open-source' | 'demo';
```

Este enum es razonablemente genérico. La única entrada discutible es `'portfolio-update'`
(muy específica de Rober). Pero tiene sentido para cualquier persona que haga build-in-public.
**Decisión:** mantener el enum, quizás renombrar `'portfolio-update'` a `'update'`.

---

### A4. Onboarding flow

#### Setup wizard — `app/setup/`

Flujo de primera vez:
1. Setup wizard detecta que la tabla `users` está vacía
2. Muestra formulario: `nombre` (display name), `email`, `password`, `confirm password`
3. Crea user con `role: 'admin'`
4. Si `SEED_DEMO_DATA=true`, ejecuta seed antes de redirigir
5. Redirige a `/` con mensaje de bienvenida

Guardia: si `users` no está vacía, redirigir a `/login`.

#### Empty states

Cada page ya tiene algún empty state básico. En la migración:
- Verificar que todos los empty states tienen CTA para crear el primer item
- El Today view vacío muestra "tu dashboard está vacío — empezá por..." con links a cada pilar

#### Seed de demo data — `scripts/seed-demo.ts`

Script que inserta:
- 2 materias ficticias con horarios
- 3 workblocks en diferentes estados
- 2 build items (idea + draft)
- 1 cliente freelance con 2 tareas
- 1 proyecto propio
- 2 community items

Todos los datos son anónimos, en inglés o genéricos (no datos de Rober).
Se ejecuta con `npm run db:seed` o vía `SEED_DEMO_DATA=true` en setup.

---

### A5. Deploy targets

**Path A — Vercel + Railway (actual)**

Documentar:
- `railway new` → PostgreSQL → copiar `DATABASE_URL`
- Vercel import → env vars → deploy
- Variables mínimas: `DATABASE_URL`, `SESSION_SECRET` (32+ chars hex), `APP_TIMEZONE`

**Path B — Vercel + Neon / Supabase**

Neon tiene tier gratuito más generoso que Railway para hobby projects.
- Connection string compatible (ambos son Postgres), cero cambio de código
- Documentar: `neon.tech` → new project → copiar URL

**Path C — Docker Compose self-hosted total**

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgres://cc:cc@db:5432/cc
      SESSION_SECRET: changeme
      APP_TIMEZONE: UTC
    depends_on: [db]
  db:
    image: postgres:16-alpine
    volumes: ["pgdata:/var/lib/postgresql/data"]
    environment:
      POSTGRES_DB: cc
      POSTGRES_USER: cc
      POSTGRES_PASSWORD: cc

volumes:
  pgdata:
```

Requiere:
- `Dockerfile` (Node 20 Alpine, `npm run build`, `CMD npm start`)
- `.env.example` con todas las vars documentadas
- `scripts/docker-entrypoint.sh` que corra `drizzle-kit migrate` antes de `next start`

---

### A6. i18n mínimo viable

**Decisión recomendada:** Un archivo `lib/strings.ts` con todos los strings en español,
con instrucciones en comentarios de cómo cambiar idioma.

```ts
// lib/strings.ts
// Para cambiar el idioma de la app, editá este archivo.
// Full i18n roadmap: github.com/tu-user/command-center/issues/XX

export const strings = {
  nav: {
    today: 'Today',
    uni: 'Uni',
    work: 'Work',
    // ...
  },
  // ...
}
```

Los componentes importan `strings` directamente. Cero overhead de runtime.
Un fork que quiera EN solo edita este archivo.

**NO usar next-intl en v1.** El overhead de refactor no justifica el beneficio.

---

## Sección C — Fases de ejecución

### Fase 1: Auth + users

**Objetivo:** La app funciona igual para vos con un solo user creado. Nadie más puede
entrar. El repo público no tiene nada tuyo. El refactor está completo.

**Archivos tocados:**

| Acción | Archivo |
|--------|---------|
| Nueva tabla | `lib/db/schema.ts` — agregar `users` + `user_id` FK a todas las tablas |
| Tipos nuevos | `lib/types.ts` — agregar `User`, `UserRole`, `UserSettings` |
| Reescribir | `lib/auth.ts` — multi-user HMAC |
| Actualizar | `proxy.ts` — extractUserId en vez de boolean |
| Nueva dep | `bcryptjs` + `@types/bcryptjs` |
| Nueva página | `app/setup/page.tsx` + `app/setup/actions.ts` |
| Modificar | `app/login/page.tsx` + `app/login/LoginForm.tsx` + `app/login/actions.ts` |
| Modificar | 8x `app/*/actions.ts` — requireUser() + user_id en queries |
| Modificar | ~12x `app/*/page.tsx` — requireUser() + filtros por user_id |
| Modificar | `lib/today.ts` — todas las queries filtradas por user_id |
| Modificar | `lib/vault-export.ts` — aceptar userId, filtrar queries |
| Nueva migración | `drizzle/0001_add_users.sql` — generado con `drizzle-kit generate` |
| Script | `scripts/migrate-personal-data.ts` — asignar user_id a rows existentes |

**Checklist de verificación:**
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — sin warnings
- [ ] Setup wizard en instancia limpia: crear primer user, login, ver dashboard vacío
- [ ] En mi instancia personal: migrar datos existentes con el script, login normal
- [ ] Dos usuarios en la misma instancia no ven datos del otro
- [ ] `/api/export` sigue funcionando con el cron (auth por CRON_SECRET)
- [ ] Logout invalida la cookie
- [ ] Cambio de password funciona

**Tiempo estimado real:** 8–10 horas de dev
- Schema + tipos: 1h
- auth.ts + proxy.ts: 2h
- Setup + login pages: 1.5h
- 8 action files + 12 pages: 3h (mecánico pero tedioso)
- Migración de datos + testing: 1.5h
- Buffer 30%: ya incluido en el estimado

**Lo que NO entra en Fase 1:**
- i18n
- De-hardcodeo de timezone y strings
- Seed de demo data
- Docker
- README público
- Settings de usuario

---

### Fase 2: De-hardcodeo + onboarding

**Objetivo:** El repo es deployable por alguien que no es vos, sin modificar código.
Todos los valores personales son configurables por env var o settings de usuario.

**Archivos tocados:**

| Acción | Archivo |
|--------|---------|
| Env var `APP_TIMEZONE` | `lib/date.ts` — `process.env.APP_TIMEZONE ?? 'UTC'` |
| `lib/strings.ts` | Nuevo — todos los strings UI extractados |
| Seed script | `scripts/seed-demo.ts` — datos de demo anónimos |
| Settings UI | `app/settings/page.tsx` — timezone, email, password |
| Admin panel | `app/settings/admin/page.tsx` — gestión de usuarios (role=admin only) |
| Vault export | `lib/vault-export.ts` — paths configurables via user settings |
| CommunityOrg | `lib/types.ts` + schema — cambiar de enum a `text` libre |
| Workblock client | Schema + UI — default vacío, obligatorio al crear |
| Empty states | Revisar todos los pilares, agregar CTAs claros |
| `app/setup/` | Agregar seed demo data toggle |
| `.env.example` | Documentar todas las vars |

**Checklist de verificación:**
- [ ] Deploy a Vercel limpia sin `.env.local` de Rober — app arranca y muestra setup
- [ ] Setup wizard crea user, opcionalmente carga demo data
- [ ] Demo data visible en todos los pilares
- [ ] Cambio de timezone en settings afecta Today view y urgency badges
- [ ] Vault export respeta paths configurados en user settings
- [ ] Community form permite org libre (no hardcodeado)
- [ ] Workblock client es campo editable

**Tiempo estimado real:** 6–8 horas de dev

**Lo que NO entra en Fase 2:**
- Docker
- next-intl / i18n completo
- Tests automatizados
- CONTRIBUTING.md

---

### Fase 3: Docs + deploy público

**Objetivo:** El repo está listo para hacerse público. README claro, Docker funcional,
historia de git limpia sin datos personales.

**Archivos tocados / creados:**

| Acción | Archivo |
|--------|---------|
| README nuevo | `README.md` — descripción, screenshots, deploy en 5 minutos |
| Docker | `Dockerfile` + `docker-compose.yml` + `scripts/docker-entrypoint.sh` |
| Seguridad | `SECURITY.md` — cómo reportar vulnerabilidades |
| Contribución | `CONTRIBUTING.md` — setup local, PRs, convenciones |
| License | `LICENSE` — MIT |
| CI básico | `.github/workflows/ci.yml` — typecheck + build en PRs |
| Limpieza | `CLAUDE.md` — remover datos personales (vault paths, materias) |
| Limpieza | Remover comentarios `// Rober`, `// supabase/schema.sql` |

**Para la historia de git limpia (sin mis datos):**
Ver Sección D — el approach de branches resuelve esto sin reescribir historia.

**Checklist de verificación:**
- [ ] Alguien sin contexto puede deployar siguiendo el README en <15 minutos
- [ ] Docker Compose levanta la app y la DB localmente
- [ ] `npm run db:seed` popula con demo data
- [ ] CI pasa en un PR de prueba
- [ ] El repo público no contiene emails, IDs, ni datos de Rober en el código

**Tiempo estimado real:** 5–6 horas de dev

---

## Sección D — Estrategia de branches

### El problema

- `master` actual tiene commits con nombres de clientes, TPs, proyectos personales en mensajes de commit
- Los datos están en la DB (Railway), no en el repo — eso es bueno
- El código hardcodeado tiene menciones de `requireRober`, `aleph`, `ucema`, strings personales
- El historial de commits no tiene datos sensibles reales (passwords, emails, datos de DB)

### Análisis de riesgo del historial actual

Revisando los commits recientes:
- `feat: icon + last github push en freelance y proyectos propios` — menciona proyectos, no es sensible
- `feat: Phase 1+2 — fix broken flows + core UX enhancements` — neutro
- `feat: command-center MVP` — neutro

Los commits no contienen datos sensibles. El riesgo principal es el código fuente
con `requireRober()` y strings específicos — eso se arregla con el refactor, no con
reescritura de historia.

### Estrategia recomendada: dos repos + subtree

```
Repo privado: github.com/bd-rober/command-center (actual, tu instancia personal)
Repo público: github.com/bd-rober/command-center-public (o nombre distinto)
```

**Flujo:**
1. Crear repo público vacío en GitHub
2. Hacer el refactor en una branch del repo privado (`chore/self-hostable-plan` → `feat/multi-user`)
3. Una vez que Fase 3 está completa, pushear **solo los commits del refactor** al repo público:
   ```bash
   git push public-remote feat/multi-user:main
   ```
4. El repo público nace sin el historial con `requireRober` ni datos personales en código
5. El repo privado sigue siendo tu instancia con tu data y tus notas en CLAUDE.md

**Branches en repo privado:**

| Branch | Propósito |
|--------|-----------|
| `master` | Tu instancia personal, siempre deployable a tu Railway/Vercel |
| `feat/multi-user` | El refactor de Fase 1 |
| `feat/de-hardcode` | El refactor de Fase 2 (branch off de feat/multi-user) |
| `feat/public-release` | Fase 3, branch de la que nace el repo público |
| `chore/self-hostable-plan` | Esta branch, solo el plan (se mergeará a master una vez aprobado) |

**Alternativa más simple (si no querés dos repos):**
Hacer el repo actual público directamente — el historial de commits no tiene datos sensibles,
y una vez que el código no tenga `requireRober` ni hardcodeos, el repo es limpio.
La diferencia con el approach de dos repos es solo estética (historial de commits).

**Mi recomendación:** La alternativa más simple. Tu historial de commits no tiene
nada comprometedor. El código es lo que importa, y eso se limpia con el refactor.
Hacer el repo actual público después de Fase 3 es suficiente.

---

## Sección E — Riesgos y unknowns

### E1. Migración de datos en producción (ALTO)

**Riesgo:** Agregar `user_id NOT NULL` a todas las tablas con datos existentes rompe
si no se hace la migración en el orden correcto.

**Mitigación:**
1. Agregar `user_id UUID REFERENCES users(id)` como nullable primero
2. Crear el user de Rober via setup wizard
3. Correr `UPDATE <tabla> SET user_id = '<rober-uuid>'` en todas las tablas
4. Agregar `NOT NULL` constraint
5. Nunca hacer esto con `drizzle-kit push` directo — generar la migración y revisarla manualmente

**Probabilidad de que algo salga mal si no se sigue este orden:** alta.

---

### E2. proxy.ts en Edge runtime no puede verificar user_id en DB (MEDIO)

**Riesgo:** El proxy corre en Edge runtime (V8 isolates). `postgres-js` requiere Node.js.
Si intentamos hacer lookup de user en el proxy, el build va a fallar.

**Estado actual:** El proxy solo verifica la firma HMAC de la cookie, sin tocar DB. Esto está bien.

**Mitigación:** Mantener el proxy como está — solo verifica que la cookie tiene un user_id
con HMAC válido. El `requireUser()` en el server component hace el lookup a DB.
El proxy es "esta cookie fue emitida por esta instancia" — suficiente.

**Unknown:** ¿Qué pasa si el user es desactivado pero su cookie sigue siendo válida?
La cookie vence en 30 días; el server component puede verificar `user.active` y redirigir.
El proxy no necesita saberlo.

---

### E3. bcryptjs en Vercel Edge (BAJO — si no lo usás en el proxy)

**Riesgo:** Si por algún motivo se importa `bcryptjs` en un archivo que se ejecuta en Edge,
el build va a fallar porque bcrypt necesita `crypto` de Node.

**Mitigación:** `bcryptjs` y `lib/auth.ts` solo se importan desde `'use server'` files o
server components. Nunca en el proxy. Agregar `import 'server-only'` al top de `lib/auth.ts`
(ya está — ver línea 12 del archivo actual).

---

### E4. Performance con índices compuestos (BAJO)

**Riesgo:** Agregar `user_id` a todos los índices implica drops + creates en tablas con datos.
En Railway, con una tabla de <1000 rows, esto es instantáneo.

**Riesgo real a largo plazo:** Los índices compuestos `(user_id, status)` son correctos para
queries multi-user, pero son "peor" que los simples actuales para una instancia de un solo user
(el planner de Postgres puede ignorar el índice compuesto si el user_id siempre es el mismo).
En la práctica, con tablas de <10k rows el impacto es cero.

---

### E5. Regresiones en queries existentes (MEDIO)

**Riesgo:** Cada query en `lib/today.ts`, las 8 action files y los pages necesita un
`.where(and(..., eq(schema.x.user_id, user.id)))`. Si se olvida una, el user verá
datos de todos los usuarios.

**Mitigación:**
- Hacer un grep de `db.select().from(schema.` en todos los archivos y verificar que
  cada uno tenga el filtro de `user_id`
- En dev, crear 2 usuarios y verificar que el usuario B no ve datos del usuario A
- Las Drizzle queries fallan silenciosamente (retornan array vacío) si el filtro
  está mal — no hay crash obvio, hay que hacer el test manual

---

### E6. Vault export con usuario desconocido (BAJO)

**Riesgo:** El cron `/api/export` no tiene user en el request. Actualmente exporta
todo sin filtro. Con multi-user, ¿qué exporta?

**Opciones:**
a) El cron exporta todos los datos de todos los usuarios (modo instancia single-user)
b) El cron exporta solo datos del admin (o del user con rol 'owner')
c) El export pasa a ser solo manual (ExportButton) y el cron se desactiva

**Recomendación:** Opción b para v1. El admin user es el dueño de la instancia.

---

### E7. `SEED_DEMO_DATA` borra datos reales si se setea accidentalmente (BAJO)

**Riesgo:** Si alguien hace deploy con `SEED_DEMO_DATA=true` en una instancia que ya tiene
datos, el seed podría pisar o duplicar data.

**Mitigación:** El seed script verifica que la tabla `users` tenga exactamente 1 user y
que la tabla `workblocks` esté vacía antes de insertar. Si hay datos, skipea y loguea un warning.

---

### E8. Gestión de usuarios en la UI (BAJO en Fase 1, MEDIO en Fase 2)

**Riesgo:** El panel de admin para crear/desactivar usuarios está en Fase 2, pero la
funcionalidad de auth en Fase 1 solo soporta el setup wizard.

**Entre Fase 1 y Fase 2:** Para agregar un segundo usuario, hay que hacerlo directo a DB
(`INSERT INTO users ...`). Esto está bien documentarlo como "known limitation of v1".

---

### E9. Historial de git con nombre propio en CLAUDE.md (COSMÉTICO)

**Riesgo:** El `CLAUDE.md` actual tiene referencias a "Rober", "bd-rober", "UCEMA",
nombres de clientes. Si el repo se hace público, esto no es sensible pero es contexto personal.

**Mitigación:** En Fase 3, el `CLAUDE.md` se reescribe para ser el manual del proyecto
open-source (sin datos personales). Tu instancia puede tener un `CLAUDE.md` en el branch
privado con tus notas personales.

---

### E10. bcrypt rounds y tiempo de login (BAJO)

**Riesgo:** bcryptjs con rounds=12 tarda ~300-400ms. En Vercel serverless, si la función
está en cold start, la primera operación de login puede tardar 1-2 segundos.

**Mitigación:** rounds=12 es el mínimo seguro recomendado por OWASP. Aceptable para una
app personal self-hosted. rounds=10 si la latencia es un problema (menos seguro).

---

## Resumen ejecutivo

**Para empezar necesito tus decisiones en:**
1. **B1** — Sessions: ¿HMAC con user_id (A) o DB sessions (B)?
2. **B2** — Registro: ¿Setup wizard (A) o abierto con guards (B)?
3. **B3** — Timezone: ¿per-user (A) o env var global (B)?
4. **B4** — i18n: ¿next-intl (A), dict estático (B), o solo un archivo de strings (C)?
5. **B5** — Demo data: ¿seed script (A) o skip por ahora?
6. **B6** — Rate limiting: ¿Upstash (B) o infra layer (C)?
7. **B7** — Vault export en multi-user: ¿solo admin (A) o configurable (B)?

Con las recomendaciones de este documento el orden de implementación sería:
**A → A → B → C → A → C → A**

**Costo total estimado:** 20-25 horas de dev real (3-4 sesiones de trabajo).
