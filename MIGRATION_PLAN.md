# MIGRATION_PLAN.md — momentum: de personal tool a self-hostable multi-user

> **Scope:** Convertir la app single-user (HMAC cookie + APP_PASSWORD) en una app
> open-source self-hostable que soporte múltiples usuarios en una instancia.
> Target: usuarios técnicos que se la clonen y levanten ellos mismos.
> **NO es SaaS multi-tenant.** Es personal tool multi-account.
>
> **Estado:** Decisiones aprobadas el 2026-06-07. Listo para arrancar Fase 1.

---

## Sección B — Decisiones aprobadas

### B1 ✅ Sessions: HMAC cookie con user_id + iat

**Decisión:** HMAC cookie stateless con `{userId}.{iat}.{hmac(userId.iat)}`.

- `userId`: UUID del usuario
- `iat`: Unix timestamp en segundos (issued-at) — permite invalidar sesiones emitidas antes de cierta fecha sin rotar el SECRET global
- `hmac`: SHA-256 sobre `userId.iat` usando `SESSION_SECRET`
- Sin refresh tokens. Sin DB sessions. Expira en 30 días por `maxAge`.

**Implicancia para revocación:**
- Rotar `SESSION_SECRET` → invalida **todas** las sesiones (logout global de la instancia)
- `users.invalidate_sessions_before` timestamp opcional: si `iat < invalidate_sessions_before`, rechazar la sesión. Permite "revocar solo este user" sin tocar el SECRET.

**Cookie format:**
```
momentum_session = {userId}.{iat}.{hmac(sha256, SESSION_SECRET, "{userId}.{iat}")}
```

---

### B2 ✅ Registro: setup wizard + ALLOW_SIGNUP

**Decisión:** Setup wizard para primera vez, con env var `ALLOW_SIGNUP=true|false` (default: `false`).

- Si tabla `users` vacía → cualquier request redirige a `/setup` (sin cookie requerida)
- `/setup` crea el primer user con `role: 'admin'`; después queda cerrado (redirect a `/login`)
- `ALLOW_SIGNUP=true` → habilita ruta `/signup` pública para que cualquiera se registre
- `ALLOW_SIGNUP=false` (default) → solo el admin crea usuarios desde `/settings/admin/users`
- `/signup` también respeta el rate limiting de B6

---

### B3 ✅ Timezone: per-user en `users.settings.timezone`

**Decisión:** Timezone vive en `users.settings.timezone` (jsonb). Default: `'UTC'`.

**Impacto en `lib/date.ts`:** Todas las funciones reciben `tz: string` como argumento explícito:

```ts
export function todayKey(tz: string): DayOfWeek
export function todayISO(tz: string): string
export function inDaysISO(days: number, tz: string): string
export function formatDate(iso: string | null, tz: string): string
export function formatFullDate(tz: string): string
export function urgencyOf(dueDate: string | null, tz: string): ...
```

`requireUser()` devuelve el user con `settings` cargados. Los server components/actions
obtienen el `tz` del user y lo pasan hacia abajo. No hay un `TZ` global.

**No hay `APP_TIMEZONE` env var.** Cada user configura su timezone en `/settings`.

---

### B4 ✅ i18n: `lib/strings.ts` con EN default, soporte ES

**Decisión:** Archivo único `lib/strings.ts`, default inglés, soporte español.

```ts
// lib/strings.ts
export const strings = {
  en: { nav: { today: 'Today', uni: 'Uni', ... }, ... },
  es: { nav: { today: 'Today', uni: 'Uni', ... }, ... },
};

export type Lang = keyof typeof strings;
export const DEFAULT_LANG: Lang = 'en';

export function t(key: string, lang: Lang = DEFAULT_LANG): string {
  // dot-notation lookup: t('nav.today', 'es')
}
```

- Idioma del usuario en `users.settings.language` (`'en'` | `'es'`)
- `requireUser()` devuelve el `lang`; los componentes lo pasan a `t()`
- Strings en inglés son el canonical; español se mantiene como traducción
- Sin next-intl, sin runtime overhead

---

### B5 ✅ Seed scripts: tres variantes

**Decisión:** Tres scripts npm:

| Script | Qué hace |
|--------|----------|
| `npm run db:seed:demo` | Datos ficticios completos: 2 materias, 5 workblocks, 3 build items, 2 clientes freelance, 2 proyectos, 3 community items. Requiere un user existente. |
| `npm run db:seed:minimal` | Solo el bootstrap mínimo para que la app arranque (sin data de usuario). Útil para CI y testing. |
| `npm run db:reset` | Drop todas las tablas + `drizzle-kit migrate` + `db:seed:minimal`. Solo para dev local — **jamás en prod.** |

El setup wizard pregunta opcionalmente si cargar demo data (llama a `db:seed:demo`).
Si `SEED_DEMO_DATA=true` en env, el seed corre automáticamente post-setup.

Guard en seed: verificar que no hay workblocks existentes antes de insertar demo data.

---

### B6 ✅ Rate limiting: híbrido en-código + docs de infra

**Decisión:** Dos capas sin dependencias externas:

**Capa 1 — Login delay en código:**
- Login fallido → `await new Promise(r => setTimeout(r, 300 + Math.random() * 200))` (300-500ms jitter)
- Hace brute force lento sin deps; el jitter dificulta timing attacks

**Capa 2 — Bloqueo por IP con tabla `login_attempts`:**

```sql
CREATE TABLE login_attempts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash    TEXT NOT NULL,   -- hash(IP + salt) para no guardar IPs reales
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  success    BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX login_attempts_ip_idx ON login_attempts(ip_hash, attempted_at);
```

- En `loginAction`: registrar intento; si hay ≥5 intentos fallidos en los últimos 15min → retornar `{ error: 'too_many_attempts' }` sin verificar password
- Limpiar intentos exitosos al loguear bien
- Un cron o cron inline limpia registros viejos (>1h) para no crecer la tabla indefinidamente
- IP se guarda como `hmac(ip, SESSION_SECRET)` — nunca la IP raw

**Nota serverless:** En Vercel, múltiples instancias pueden tener estados distintos en memoria.
La tabla en DB es la única fuente de verdad, por eso se usa la tabla y no `Map` en memoria.

**README recomienda:** Nginx `limit_req_zone` o Caddy rate limiting para instancias self-hosted.

---

### B7 ✅ Vault export: per-user, opt-in, deshabilitado por default

**Decisión:** Export per-user. Cada usuario puede exportar SUS datos.

- Export **deshabilitado por default**. Opt-in desde `/settings` (o desde panel admin para otros usuarios).
- `users.settings.export_enabled: boolean` (default `false`)
- `users.settings.vault_path: string` (ej: `~/Documents/vault`) — path base configurable
- `ExportButton` visible solo si `user.settings.export_enabled === true`
- Cron `/api/export` itera sobre todos los users con `export_enabled: true` y exporta sus datos
- Los paths del export se construyen desde `vault_path` del user, no hardcodeados

---

## Sección A — Inventario de cambios

### A1. Auth multi-user

#### `lib/auth.ts` — reescritura

| Función actual | Función nueva | Cambio |
|----------------|---------------|--------|
| `signSession()` | `signSession(userId: string): string` | Embebe userId + iat |
| `verifySession(signed)` | `verifySession(signed): string \| null` | Retorna userId o null |
| `requireRober(): Promise<void>` | `requireUser(): Promise<User>` | Retorna user completo con settings |
| `passwordMatches(input)` | eliminada | Lógica pasa a `loginAction` via bcryptjs |
| `isAuthed()` | eliminada | Reemplazada por `requireUser()` |
| — | `hashPassword(plain): Promise<string>` | bcryptjs, rounds=12 |
| — | `verifyPassword(plain, hash): Promise<boolean>` | bcryptjs.compare, timing-safe |

**Dependencia nueva:** `bcryptjs` + `@types/bcryptjs`
- Puro JS, zero native deps, funciona en todos los runtimes Vercel/Node
- rounds=12 (~300ms en hardware moderno) — aceptable para uso personal

**`requireUser()` internals:**
1. Lee cookie `momentum_session`
2. `verifySession()` extrae userId + verifica HMAC + verifica que `iat >= user.invalidate_sessions_before`
3. Query a DB: `SELECT * FROM users WHERE id = userId AND active = true`
4. Si no existe o está inactivo → throw `'NOT_SIGNED_IN'`
5. Retorna `User` con settings parseados

#### `proxy.ts` — cambios mínimos

- `COOKIE_PAYLOAD = 'ok'` → el payload es ahora `userId.iat`
- `verifySession(signed, secret)` retorna `boolean` (el proxy no necesita el userId)
- La verificación HMAC se adapta al nuevo formato de 3 partes
- Ruta pública nueva: `/setup` y `/signup` (cuando `ALLOW_SIGNUP=true`)
- El proxy **no** toca la DB — sigue siendo stateless

#### `app/login/` — modificar

- `LoginForm.tsx`: agregar campo `email` (antes solo `password`)
- `loginAction`: busca user por email → `verifyPassword()` → registra en `login_attempts` → setea cookie con nuevo formato
- Si `users` table vacía → redirect a `/setup`
- Login fallido: delay 300-500ms + log en `login_attempts`

#### `app/setup/` — nuevo (Fase 1)

- `page.tsx`: servidor verifica que `users` está vacía; si no, redirect a `/login`
- Form: display_name, email, password, confirm_password
- `actions.ts:setupAction()`: crea admin, redirige a `/`
- Si `SEED_DEMO_DATA=true`: llama al seed antes de redirigir

#### `app/signup/` — nuevo (Fase 1, solo si `ALLOW_SIGNUP=true`)

- Page verifica `process.env.ALLOW_SIGNUP === 'true'`; si no, 404
- Rate limiting: verifica `login_attempts` antes de crear

#### `app/settings/` — nuevo (Fase 2)

- `/settings` → perfil del usuario: display_name, email, password, timezone, language
- `/settings/admin` → solo role=admin: lista users, crear/desactivar, toggle export

---

### A2. Schema migration

#### Nueva tabla `users`

```sql
CREATE TABLE users (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                     TEXT NOT NULL UNIQUE,
  display_name              TEXT,
  password_hash             TEXT NOT NULL,
  role                      TEXT NOT NULL DEFAULT 'member', -- 'admin' | 'member'
  active                    BOOLEAN NOT NULL DEFAULT true,
  settings                  JSONB NOT NULL DEFAULT '{}',
  invalidate_sessions_before BIGINT,  -- Unix timestamp; sessions con iat < este valor se rechazan
  created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_login_at             TIMESTAMP WITH TIME ZONE
);

CREATE INDEX users_email_idx ON users(email);
```

`settings` jsonb estructura canónica:
```json
{
  "timezone": "UTC",
  "language": "en",
  "theme": "dark",
  "export_enabled": false,
  "vault_path": ""
}
```

#### Nueva tabla `login_attempts` (B6)

```sql
CREATE TABLE login_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash      TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  success      BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX login_attempts_ip_idx ON login_attempts(ip_hash, attempted_at);
```

#### Nueva tabla `password_reset_tokens` (N1)

```sql
CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,  -- hmac(token_raw, SESSION_SECRET)
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at     TIMESTAMP WITH TIME ZONE
);

CREATE INDEX prt_user_idx ON password_reset_tokens(user_id);
CREATE INDEX prt_token_idx ON password_reset_tokens(token_hash);
```

#### Nueva tabla `audit_log` (N2)

```sql
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,       -- 'create' | 'update' | 'delete' | 'login' | 'logout'
  entity_type TEXT,                -- 'workblock' | 'assignment' | 'build_item' | etc.
  entity_id   UUID,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX audit_log_user_idx ON audit_log(user_id, created_at DESC);
CREATE INDEX audit_log_entity_idx ON audit_log(entity_type, entity_id);
```

#### FK `user_id` en tablas existentes

| Tabla | Cambio | Nota |
|-------|--------|------|
| `subjects` | + `user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL` | |
| `assignments` | ídem | |
| `workblocks` | ídem | |
| `build_items` | ídem | |
| `freelance_clients` | ídem | |
| `freelance_tasks` | ídem | Desnormalizar para search/Today sin JOIN |
| `own_projects` | ídem | |
| `community_items` | ídem | |
| `vault_exports` | ídem | |

#### Índices compuestos (reemplazar simples)

```sql
-- assignments
DROP INDEX assignments_status_idx;
DROP INDEX assignments_due_idx;
CREATE INDEX assignments_user_status_idx ON assignments(user_id, status);
CREATE INDEX assignments_user_due_idx ON assignments(user_id, due_date);

-- workblocks
DROP INDEX workblocks_status_idx;
DROP INDEX workblocks_priority_idx;
DROP INDEX workblocks_position_idx;
CREATE INDEX workblocks_user_status_idx ON workblocks(user_id, status);
CREATE INDEX workblocks_user_position_idx ON workblocks(user_id, status, position);

-- build_items
DROP INDEX build_items_status_idx;
DROP INDEX build_items_published_idx;
CREATE INDEX build_items_user_status_idx ON build_items(user_id, status);
CREATE INDEX build_items_user_published_idx ON build_items(user_id, published_at);

-- freelance
DROP INDEX freelance_clients_status_idx;
DROP INDEX freelance_tasks_client_idx;
DROP INDEX freelance_tasks_status_idx;
CREATE INDEX freelance_clients_user_status_idx ON freelance_clients(user_id, status);
CREATE INDEX freelance_tasks_user_status_idx ON freelance_tasks(user_id, status);
CREATE INDEX freelance_tasks_client_idx ON freelance_tasks(client_id);  -- mantener para JOINs

-- otros
DROP INDEX own_projects_status_idx;
DROP INDEX community_items_org_idx;
DROP INDEX community_items_status_idx;
CREATE INDEX own_projects_user_status_idx ON own_projects(user_id, status);
CREATE INDEX community_items_user_status_idx ON community_items(user_id, status);
```

#### Migración de datos — instancia personal

**Secuencia obligatoria (no usar `drizzle-kit push` directo):**

1. `npx drizzle-kit generate --name add_users` — generar SQL
2. Revisar manualmente el SQL antes de aplicar
3. Aplicar solo las `CREATE TABLE` nuevas, sin los `NOT NULL` en user_id todavía
4. Correr `scripts/migrate-personal-data.ts`:
   - Crear user admin con email/password elegidos
   - `UPDATE subjects SET user_id = $adminId WHERE user_id IS NULL` (x9 tablas)
5. Aplicar `NOT NULL` constraint como segunda migración
6. Verificar con `SELECT COUNT(*) FROM workblocks WHERE user_id IS NULL` → 0

---

### A3. Hardcodeo a parametrizar

#### Críticos (bloquean multi-user)

| Hardcodeo | Archivo | Solución aprobada |
|-----------|---------|-------------------|
| `const TZ = 'America/Argentina/Buenos_Aires'` | `lib/date.ts` | Eliminar. Todas las funciones toman `tz: string` |
| `client: 'aleph'` default en workblocks | `lib/db/schema.ts` | Default `''`, campo obligatorio en UI |
| `CommunityOrg` enum hardcodeado | `lib/types.ts` | Cambiar a `text` libre. `'other'` sigue existiendo pero ya no hay enum |
| `requireRober()` | 20+ archivos | `requireUser()` |
| `COOKIE_PAYLOAD = 'ok'` | `proxy.ts`, `lib/auth.ts` | Nuevo formato con userId + iat |

#### Moderados (bloquean open source clean)

| Hardcodeo | Archivo | Solución |
|-----------|---------|----------|
| Vault paths hardcodeados | `lib/vault-export.ts` | `user.settings.vault_path` como base |
| `[[wikilinks]]` de Rober | `lib/vault-export.ts` | Eliminar; generar links desde metadata del user |
| `'es-AR'` locale en `formatDate` | `lib/date.ts` | Usar `user.settings.language` mapeado a locale |
| `tags: '[trabajo, aleph, weekly]'` | `lib/vault-export.ts` | Tags genéricos o configurables |

#### Cosméticos (Fase 3, pre-public)

| Hardcodeo | Archivo | Solución |
|-----------|---------|----------|
| `// espejo del SQL en supabase/schema.sql` | `lib/db/schema.ts` | Actualizar comment |
| `// espejo del schema de Supabase` | `lib/types.ts` | Actualizar comment |
| `platforms: ['x', 'linkedin']` | `lib/db/schema.ts` | Mantener (genérico) |
| `'portfolio-update'` en BuildType | `lib/types.ts` | Renombrar a `'update'` |

---

### A4. Onboarding flow

**Setup wizard** (`app/setup/`):
1. Detecta `users` vacía → muestra form de primer admin
2. Form: display_name, email, password, confirm_password, timezone (selector)
3. Crea admin → si `SEED_DEMO_DATA=true`, llama seed → redirige a `/` con banner "bienvenido"
4. Si `users` no vacía → redirect a `/login`

**Empty states:** Todos los pilares ya tienen empty states básicos. Revisar en Fase 2 que
todos incluyan CTA claro para crear el primer item con `?setup=true` query param si corresponde.

**Seed scripts** (ver B5): `db:seed:demo`, `db:seed:minimal`, `db:reset`

---

### A5. Deploy targets

**Path A — Vercel + Railway (actual)**

Variables mínimas:
```
DATABASE_URL=postgres://...
SESSION_SECRET=<32+ chars hex>
CRON_SECRET=<random>
# Opcionales:
ALLOW_SIGNUP=false
SEED_DEMO_DATA=false
RESEND_API_KEY=<para password reset>
```

**Path B — Vercel + Neon**

Connection string compatible, cero cambio de código. Documentar en README.

**Path C — Docker Compose**

```yaml
# docker-compose.yml (borrador — Fase 3)
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgres://cc:cc@db:5432/cc
      SESSION_SECRET: changeme-32-chars-minimum-please
      NODE_ENV: production
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

Requiere: `Dockerfile`, `scripts/docker-entrypoint.sh` (corre `drizzle-kit migrate` al inicio).

---

### A6. i18n — `lib/strings.ts`

Ver B4. Implementar en Fase 2. Los strings actuales en español se mantienen para los
componentes existentes; el extracto a `strings.ts` es incremental.

---

## Sección N — Agregados post-review

### N1. Password reset por email (Fase 1)

**Tabla:** `password_reset_tokens` (ver A2)

**Flujo:**
1. `app/forgot-password/` → form con email
2. `forgotPasswordAction`: busca user por email, genera token random (32 bytes), guarda `hmac(token, SESSION_SECRET)` en DB con `expires_at = now() + 1h`
3. Si `RESEND_API_KEY` está configurado → envía email con el link via Resend
4. Si `SMTP_*` está configurado → envía via nodemailer
5. Si **ninguno** está configurado → `console.log('Reset URL:', url)` al stdout del server. Documentado en README como "log-based reset" para instancias sin email.
6. `app/reset-password/[token]/` → verifica token → form nueva password → invalida token (`used_at = now()`)

**Env vars:**
```
# Resend (opción A)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@tu-dominio.com

# SMTP genérico (opción B)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
```

Auto-detect: si `RESEND_API_KEY` existe, usar Resend. Si no, si `SMTP_HOST` existe, usar SMTP. Si ninguno, modo log.

**Dependencia:** `resend` (ya en el workspace en otros proyectos, pero confirmar si agregar acá)

**+4h al estimado de Fase 1**

---

### N2. Audit log mínimo (Fase 1)

**Tabla:** `audit_log` (ver A2)

**Helper:**
```ts
// lib/audit.ts
import 'server-only';
export async function logAudit(params: {
  userId: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout';
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void>
```

**Integrar en:**
- `loginAction` → action: `'login'`
- `logoutAction` → action: `'logout'`
- Cada `create*` action → action: `'create'`, entityType: `'workblock'` etc.
- Cada `delete*` action → action: `'delete'`
- Las mutaciones de update que tengan impacto de datos (no status changes triviales)

**Sin UI por ahora.** La tabla se puede consultar con drizzle-kit studio o raw SQL.
UI de audit log es Fase 4+ (fuera de scope v1).

**No bloquear la acción si el audit falla** — usar `logAudit(...).catch(console.error)` para que un error de log no rompa la operación principal.

**+3h al estimado de Fase 1**

---

### N3. Security headers (Fase 3)

**Implementar en `next.config.ts` via `headers()`:**

```ts
// CSP — ajustada para motion v12, @vercel/analytics, @base-ui/react
'Content-Security-Policy': [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",  // analytics
  "style-src 'self' 'unsafe-inline'",  // Tailwind inline styles
  "img-src 'self' data: blob:",
  "connect-src 'self' https://vitals.vercel-insights.com",
  "font-src 'self'",
  "frame-ancestors 'none'",
].join('; ')

'X-Frame-Options': 'DENY'
'X-Content-Type-Options': 'nosniff'
'Referrer-Policy': 'strict-origin-when-cross-origin'
'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'  // solo en prod
```

**Precaución con CSP:**
- `motion` v12 usa animaciones CSS inline → necesita `'unsafe-inline'` en `style-src`
- Si se remueve en el futuro, considerar CSS modules
- Testear con [securityheaders.com](https://securityheaders.com) post-deploy

**+2h al estimado de Fase 3**

---

## Sección C — Fases de ejecución (actualizada)

### Fase 1: Auth + users + security baseline

**Objetivo:** La app funciona para vos con un solo user. Multi-user habilitado a nivel de
schema. Password reset funcional. Audit log registrando mutaciones. Todo el hardcodeo de
auth limpio.

**Archivos a crear/modificar:**

| Acción | Archivo | Notas |
|--------|---------|-------|
| Reescribir | `lib/auth.ts` | requireUser(), signSession con iat, hashPassword, verifyPassword |
| Nueva dep | `bcryptjs` + `@types/bcryptjs` | |
| Nuevo | `lib/audit.ts` | logAudit() helper |
| Actualizar | `proxy.ts` | Nuevo formato de cookie + rutas /setup y /signup públicas |
| Schema | `lib/db/schema.ts` | users, login_attempts, password_reset_tokens, audit_log, user_id FK en 9 tablas |
| Tipos | `lib/types.ts` | User, UserRole, UserSettings, AuditAction |
| Nueva migración | `drizzle/0001_add_users.sql` | generado con `drizzle-kit generate`, revisado manualmente |
| Script | `scripts/migrate-personal-data.ts` | Asignar user_id a rows existentes |
| Nuevo | `app/setup/page.tsx` + `app/setup/actions.ts` | Setup wizard |
| Nuevo | `app/signup/page.tsx` + `app/signup/actions.ts` | Solo si ALLOW_SIGNUP=true |
| Nuevo | `app/forgot-password/page.tsx` + `app/forgot-password/actions.ts` | |
| Nuevo | `app/reset-password/[token]/page.tsx` + actions | |
| Modificar | `app/login/page.tsx` + `LoginForm.tsx` + `actions.ts` | Email + password, login_attempts |
| Modificar | `lib/today.ts` | Recibe userId + tz, todas las queries filtradas |
| Modificar | `lib/date.ts` | Eliminar TZ global, todas las funciones toman `tz: string` |
| Modificar | 8x `app/*/actions.ts` | requireUser() + user_id + logAudit() |
| Modificar | ~12x `app/*/page.tsx` | requireUser() + user_id en queries + tz pass-through |
| Modificar | `lib/vault-export.ts` | Recibe userId, filtrar queries por user_id |

**Checklist de verificación Fase 1:**
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — sin warnings
- [ ] Setup wizard en DB vacía: crear admin, login, ver dashboard
- [ ] En instancia personal: migrar datos con script, login normal, todos los datos visibles
- [ ] Crear segundo usuario → no ve datos del primero (verificar pilares: uni, work, build, freelance, projects, community)
- [ ] Login fallido ≥5 veces en 15min → bloqueado
- [ ] Login fallido → delay >300ms
- [ ] Password reset: con email configurado → recibe link; sin email → log en stdout
- [ ] Reset token se invalida tras usarse (no se puede usar dos veces)
- [ ] Reset token expira tras 1h
- [ ] `audit_log` tiene entradas tras create/delete de workblock
- [ ] `/api/export` sigue funcionando con CRON_SECRET
- [ ] Logout invalida la cookie (redirect a /login)
- [ ] Cookie con iat antiguo (antes de `invalidate_sessions_before`) rechazada

**Tiempo estimado real Fase 1:** 15–18 horas
- Schema + tipos: 1.5h
- auth.ts reescritura: 2h
- proxy.ts: 1h
- Setup + login + signup: 2h
- Password reset (N1): 4h
- Audit log (N2): 3h
- 8 actions + 12 pages + today.ts: 4h (mecánico)
- Migración de datos + testing: 1.5h

**Lo que NO entra en Fase 1:**
- i18n / strings.ts
- Timezone en settings de UI (existe en DB, pero no hay UI para cambiarlo todavía)
- Settings page completa
- Seed de demo data
- Docker
- Security headers

---

### Fase 2: De-hardcodeo + onboarding + settings

**Objetivo:** Deployable por cualquier persona sin tocar código. Todos los valores personales
son configurables. Settings de usuario funcionales. Seed de demo data.

**Archivos a crear/modificar:**

| Acción | Archivo |
|--------|---------|
| Nuevo | `lib/strings.ts` — strings EN/ES, función `t()` |
| Nuevo | `scripts/seed-demo.ts`, `scripts/seed-minimal.ts` |
| Nuevo | `package.json` scripts: `db:seed:demo`, `db:seed:minimal`, `db:reset` |
| Nuevo | `app/settings/page.tsx` — display_name, email, password, timezone, language |
| Nuevo | `app/settings/admin/page.tsx` — gestión de usuarios (role=admin) |
| Modificar | `lib/vault-export.ts` — paths desde `user.settings.vault_path`, sin wikilinks hardcodeados |
| Modificar | `lib/types.ts` — cambiar `CommunityOrg` de enum a `text` libre |
| Modificar | `lib/db/schema.ts` — `workblocks.client` default vacío; community org sin enum |
| Modificar | `app/community/actions.ts` + form — org como campo de texto libre |
| Modificar | `lib/date.ts` — `formatDate()` usa `user.settings.language` para locale |
| Modificar | `app/setup/` — agregar timezone selector, SEED_DEMO_DATA toggle |
| Modificar | `.env.example` — documentar todas las vars con comentarios |
| Actualizar | Todos los componentes — integrar `t()` para strings de UI |
| Actualizar | `lib/db/schema.ts` + comments — limpiar referencias a Supabase |

**Checklist de verificación Fase 2:**
- [ ] Deploy a Vercel vacía: app arranca, muestra `/setup`
- [ ] Setup wizard completo con selección de timezone y demo data
- [ ] Demo data visible en todos los pilares tras setup
- [ ] Settings page: cambiar timezone → Today view refleja cambio
- [ ] Settings page: cambiar language → UI cambia (EN ↔ ES)
- [ ] Community form acepta org libre (no dropdown hardcodeado)
- [ ] Workblock: campo `client` vacío por default, UI lo pide al crear
- [ ] Vault export respeta `vault_path` del user settings
- [ ] `npm run db:reset` limpia y reinicia en dev

**Tiempo estimado real Fase 2:** 10–12 horas

**Lo que NO entra en Fase 2:**
- Docker
- Security headers
- CONTRIBUTING.md / SECURITY.md
- CI workflow

---

### Fase 3: Docs + deploy público + security hardening

**Objetivo:** El repo está listo para hacerse público. README completo, Docker funcional,
security headers configurados.

**Archivos a crear/modificar:**

| Acción | Archivo |
|--------|---------|
| Nuevo | `README.md` — descripción, screenshots, deploy en 5 min, 3 paths |
| Nuevo | `Dockerfile` + `docker-compose.yml` + `scripts/docker-entrypoint.sh` |
| Nuevo | `SECURITY.md` — cómo reportar vulnerabilidades |
| Nuevo | `CONTRIBUTING.md` — setup local, convenciones, PRs |
| Nuevo | `LICENSE` — MIT |
| Nuevo | `.github/workflows/ci.yml` — typecheck + build en PRs |
| Modificar | `next.config.ts` — security headers (N3): CSP, HSTS, X-Frame-Options, etc. |
| Limpiar | `CLAUDE.md` — reescribir sin datos personales (versión open-source) |
| Limpiar | Comentarios con referencias personales en código |
| Modificar | `BuildType` — renombrar `'portfolio-update'` a `'update'` |

**Checklist de verificación Fase 3:**
- [ ] Alguien sin contexto puede deployar con el README en <15 minutos
- [ ] Docker Compose: `docker compose up` levanta la app en localhost:3000
- [ ] CI pasa en PR de prueba
- [ ] securityheaders.com da A o A+ post-deploy
- [ ] CSP no rompe motion, analytics, ni base-ui
- [ ] `npm run db:seed` popula con demo data
- [ ] El repo no contiene emails, IDs personales, ni datos de Rober en código

**Tiempo estimado real Fase 3:** 8–9 horas (incluye N3)

---

## Sección D — Estrategia de branches

### Análisis de riesgo del historial

El historial de commits no contiene datos sensibles (no hay passwords, emails, IDs de DB).
Los commits mencionan "Aleph", "freelance", proyectos — nada comprometedor.
El riesgo está en el **código**, no en el historial: `requireRober()`, strings en español,
vault paths. El refactor limpia eso.

### Estrategia recomendada: repo actual + publicar tras Fase 3

**Simplest approach:**
1. Hacer el refactor en branches del repo privado actual
2. Tras Fase 3, hacer el repo público directamente
3. El historial pre-refactor tiene `requireRober` → pero eso está en el pasado del historial,
   no en el código actual. Cualquiera que clone el repo ve el código de `main`, no el historial.

**Si querés historial 100% limpio:**
- Crear repo público vacío `github.com/<user>/Momentum`
- Pushear solo la branch `feat/public-release` como `main` del repo público
- El repo público nace sin historial previo

**Branches activas:**

| Branch | Propósito |
|--------|-----------|
| `master` | Instancia personal, siempre deployable |
| `chore/self-hostable-plan` | Este plan (mergear a master) |
| `feat/multi-user` | Fase 1 (branching off master) |
| `feat/de-hardcode` | Fase 2 (branching off feat/multi-user) |
| `feat/public-release` | Fase 3 (branching off feat/de-hardcode) |

**Durante el desarrollo:** Tu instancia en Vercel sigue apuntando a `master`.
Una vez que Fase 1 está testeada, mergear a master y re-deployar.

---

## Sección E — Riesgos y unknowns

### E1. Migración de datos en producción (ALTO)

**Riesgo:** Agregar `user_id NOT NULL` a tablas con datos existentes rompe si no se hace en orden.

**Mitigación:** Secuencia en 3 pasos (nullable → backfill → not null). Ver A2 para el detalle.
Nunca usar `drizzle-kit push` directo — generar la migración SQL y revisarla.

---

### E2. proxy.ts — Edge runtime no puede tocar DB (MEDIO)

**Riesgo:** Si se agrega lógica de DB al proxy, el build falla (postgres-js requiere Node).

**Mitigación:** El proxy solo verifica la firma HMAC del nuevo formato. El lookup de user
en DB se hace en `requireUser()` (server-only). El proxy es "cookie emitida por esta instancia"
— sin lookups a DB.

---

### E3. bcryptjs en Vercel Edge (BAJO)

**Mitigación:** `bcryptjs` siempre importado desde archivos `'use server'` o `import 'server-only'`.
El `lib/auth.ts` ya tiene `import 'server-only'` en la línea 1.

---

### E4. Performance índices compuestos (BAJO)

Con tablas <10k rows el impacto es cero. Los índices compuestos `(user_id, status)` son
la elección correcta para multi-user. Para single-user el planner puede usarlos igualmente.

---

### E5. Regresiones en queries — filtro user_id olvidado (MEDIO)

**Riesgo:** Si se olvida `.where(eq(schema.x.user_id, user.id))` en una query, el user B ve datos del user A. Las queries Drizzle no crashean — devuelven rows de todos los users silenciosamente.

**Mitigación:** Grep final sobre todos los `db.select().from(schema.` para verificar que cada
uno tiene el filtro. Crear 2 users en dev y verificar isolación manual en cada pilar.

---

### E6. login_attempts en serverless (BAJO-MEDIO)

**Riesgo:** En Vercel con múltiples instancias, la misma IP puede llegar a distintas instancias
y el contador en memoria estaría fragmentado. **Por eso se usa DB** (tabla `login_attempts`),
no `Map` en memoria.

**Riesgo residual:** La tabla crece si no se limpia. El `loginAction` limpia intentos >1h en
cada llamada (`DELETE FROM login_attempts WHERE attempted_at < now() - interval '1 hour'`).
Esto agrega 1 query por intento de login — aceptable.

---

### E7. Token de reset de password en logs/historial (BAJO)

**Riesgo:** Si el token raw se loguea accidentalmente.

**Mitigación:** Solo guardar `hmac(token_raw, SESSION_SECRET)` en DB. El token raw viaja
solo por email o se loguea como URL completa (deliberado en modo "sin email"). El token
tiene TTL de 1h y es single-use.

---

### E8. CSP rompiendo motion/analytics (MEDIO — Fase 3)

**Riesgo:** La CSP estricta puede romper `motion` v12 (CSS inline) o `@vercel/analytics`.

**Mitigación:**
- `style-src 'unsafe-inline'` cubre motion hasta que migre a CSS modules
- `connect-src https://vitals.vercel-insights.com` cubre analytics
- Testear en staging antes de aplicar a prod

---

### E9. `resend` como dep nueva (BAJO)

**Riesgo:** Agregar `resend` como dependencia para password reset.

**Mitigación:** Es opcional — si `RESEND_API_KEY` no está configurado, el sistema usa SMTP
o log-mode. La dep solo se activa si el env var está presente. Alternativa: usar `nodemailer`
que es más universal pero más verbose.

**Decisión pendiente:** ¿Agregar `resend` como dep? Si la app ya usa Resend en otros proyectos
del workspace (sí — ver CLAUDE.md) y ya se conoce la API, es la opción más limpia.

---

### E10. Tamaño del `strings.ts` (BAJO)

**Riesgo:** Con ~200 strings en 2 idiomas, el archivo puede volverse difícil de mantener.

**Mitigación:** Estructura anidada por módulo (nav, today, work, uni, etc.). Los componentes
usan dot notation `t('work.addBlock')`. El tamaño es manejable con un editor moderno.

---

## Out of scope para v1

Los siguientes features **NO entran en ninguna de las 3 fases**. Si aparece la tentación
de agregarlos, volver a leer esta sección.

| Feature | Razón para excluir |
|---------|-------------------|
| **2FA / TOTP** | Complejidad alta, bajo beneficio para instancia personal. Agregar post-v1 si hay demanda. |
| **OAuth / Google login** | Requiere registrar OAuth app en Google. Overhead para self-hosters. Fuera de scope. |
| **Webhooks** | Sin casos de uso claros todavía en la app. |
| **API pública** | La app es UI-first. Una API REST/GraphQL es un proyecto separado. |
| **Dark/light toggle dinámico** | La app ya tiene dark mode. Un toggle en runtime requiere hidratación de theme antes del render → complejidad SSR. |
| **Import desde otras apps** | Desde Todoist, Notion, etc. Mucho trabajo por user base desconocida. |
| **Compartir items (share links)** | Requiere auth condicional por item. Fuera de scope multi-user básico. |
| **Notificaciones push** | Service workers + backend push = complejidad alta para MVP. |
| **App móvil nativa** | La PWA es suficiente para uso personal. |
| **Multi-instancia / clustering** | Esta es una app self-hosted single-instance. |

---

## Resumen ejecutivo

**Decisiones aprobadas:**
- B1: HMAC cookie con `userId.iat.hmac` ✅
- B2: Setup wizard + `ALLOW_SIGNUP` env var ✅
- B3: Timezone per-user en `users.settings` ✅
- B4: `lib/strings.ts` EN/ES, default EN ✅
- B5: Tres seed scripts (`demo`, `minimal`, `reset`) ✅
- B6: Login delay + tabla `login_attempts` + README con recomendación de reverse proxy ✅
- B7: Export per-user, opt-in, deshabilitado por default ✅

**Agregados aprobados:**
- N1: Password reset por email (+4h, Fase 1) ✅
- N2: Audit log mínimo (+3h, Fase 1) ✅
- N3: Security headers (+2h, Fase 3) ✅

**Estimado total:** 35–40 horas de dev real
- Fase 1: 15–18h
- Fase 2: 10–12h
- Fase 3: 8–9h
- Buffer implícito: ~2h distribuido (siempre hay algo que tarda más)

**Stack de deps nuevas:**
- `bcryptjs` + `@types/bcryptjs` (Fase 1, required)
- `resend` (Fase 1, optional — para password reset por email)

**Siguiente paso:** Arrancar Fase 1 en sesión nueva, branch `feat/multi-user`.
Orden de implementación sugerido dentro de Fase 1:
1. Schema + tipos + migración manual
2. `lib/auth.ts` reescritura
3. `proxy.ts` actualizar
4. Setup wizard + login pages
5. Password reset (N1)
6. `lib/audit.ts` + logAudit en actions (N2)
7. Migrar los 8 action files + 12 pages
8. `lib/today.ts` + `lib/date.ts`
9. Script de migración de datos personales
10. Testing de isolación multi-user
