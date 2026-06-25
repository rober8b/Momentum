# DATABASE.md — Momentum

Schema, migration workflow, local dev DB, y runbooks de operaciones de DB.

---

## Schema overview

15 tablas en `lib/db/schema.ts` (single source of truth):

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

**Motor dinámico (tablas nuevas — ver `docs/DYNAMIC_PILLARS.md`):**

| Tabla | Para qué |
|-------|----------|
| `pillars` | Configuración por-user de cada pilar (key, name, icon, view_type, status_workflow jsonb, config jsonb). |
| `pillar_items` | Items de todos los pilares dinámicos. `parent_item_id` self-ref, `is_container` bool, `fields` jsonb. |

---

## Cambiar el schema (flujo real, prod)

1. Editar `lib/db/schema.ts`
2. Si agregás un enum value, también editarlo en `lib/types.ts`
3. `npx drizzle-kit generate --name <descripcion>` — genera `drizzle/000X_<descripcion>.sql`
4. Revisar el SQL generado y commitear junto con el cambio de schema
5. `git push` → Vercel corre `db:migrate` automáticamente en el build y aplica la migración a prod

**`npx drizzle-kit push` es SOLO para experimentos descartables en local.** Si el cambio se queda, generá la migración antes de seguir. Nunca correr `push` contra `DATABASE_URL` de prod — eso aplica el schema sin dejar rastro en `drizzle/` y rompe el tracking de `__drizzle_migrations`.

---

## Migration workflow — automated on deploy

Las migraciones se aplican automáticamente en cada deploy de Vercel:

- `npm run vercel-build` (= `npm run db:migrate && next build`) es el build command real en Vercel. Vercel detecta `vercel-build` en `package.json` y lo usa en vez de `build`. `npm run build` / `npm run dev` en local **no** corren migraciones.
- `npm run db:migrate` usa `migrate()` de `drizzle-orm/postgres-js/migrator` sobre `./drizzle`. Es **idempotente**: si no hay migraciones pendientes (según `drizzle.__drizzle_migrations`), no hace nada.
- Si `DATABASE_URL` no está seteada, la conexión falla, o una migración tira error → `process.exit(1)` → el build de Vercel falla y el deploy se bloquea (fail loud, nunca silencioso).
- **Self-host:** correr `npm run db:migrate:local` (lee `.env.local`) después de cada `git pull` que incluya nuevas migraciones en `drizzle/`.

**Para evitar drift:** `drizzle-kit generate` + commit es el flujo real. Antes de generar, correr `npx drizzle-kit generate` sin cambios pendientes debería decir `No schema changes, nothing to migrate`. Si no, hay drift que resolver primero.

---

## Baselinear una DB existente (fresh prod o recovery de drift)

Si una DB ya tiene el schema completo aplicado vía `push` pero **no** tiene la tabla `drizzle.__drizzle_migrations`, el primer `migrate()` va a intentar re-correr `0000_baseline.sql` (`CREATE TABLE ...`) y falla porque las tablas ya existen.

Fix: `npm run db:baseline` (`scripts/db-baseline.ts`) — crea `drizzle.__drizzle_migrations` (additive, `CREATE SCHEMA/TABLE IF NOT EXISTS`) y marca cada entry de `drizzle/meta/_journal.json` como ya aplicada sin ejecutar el SQL. Es idempotente.

- **DB nueva (sin tablas todavía):** NO uses `db:baseline` — corré `db:migrate` directo.
- **DB con schema ya aplicado pero sin tracking:** correr `db:baseline:local` una sola vez, después `db:migrate` queda al día.
- **Si migraciones y DB driftean:** comparar con `drizzle-kit generate` (debería decir "No schema changes") y decidir manualmente si generar una migración correctiva o re-baselinear.

---

## Local dev database (Docker)

Default para desarrollo local. Un Postgres 16 en Docker completamente separado de Railway/prod.

```
Host:     localhost:5432
User:     momentum
Password: momentum
DB:       momentum
URL:      postgres://momentum:momentum@localhost:5432/momentum
```

Las credenciales están commiteadas intencionalmente — son solo locales, no son secretos.

### Bootstrap (primera vez o reset)

```bash
# 1. Asegurarse de tener Docker Desktop corriendo
npm run db:up              # arranca el contenedor
# 2. En .env.local:
#    DATABASE_URL=postgres://momentum:momentum@localhost:5432/momentum
npm run db:migrate:local   # aplica todas las migraciones → crea todas las tablas
# 3. Opcional: cargar datos de prueba
npm run db:seed:demo       # seed con data de ejemplo
```

No hace falta `db:baseline` en este flujo: la DB arranca vacía y `migrate()` crea `drizzle.__drizzle_migrations` desde cero.

### Ciclo diario

```bash
npm run db:up     # si el contenedor no está corriendo
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

---

## Tareas comunes

### Agregar una columna nueva a una tabla legacy

1. Editar `lib/db/schema.ts` — agregar el campo
2. Editar `lib/types.ts` — actualizar el type correspondiente
3. Editar `lib/today.ts` en el row mapper si aplica
4. `npx drizzle-kit generate --name add_<columna>_to_<tabla>` y commitear la migración
5. Actualizar el server action si entra al insert/update
6. Actualizar el form/card si va en UI

### Renombrar / migrar una tabla

1. Editar `lib/db/schema.ts`
2. `npx drizzle-kit generate --name rename_x_to_y`
3. Revisar manualmente el SQL generado (drizzle-kit a veces sugiere drop+create — confirmar que no perdés data)
4. Commitear y `git push` — Vercel aplica la migración en el siguiente deploy

### Cambiar la password de un usuario (desde DB)

```bash
# Generar hash con node
node -e "const b = require('bcryptjs'); b.hash('nueva_password', 12).then(h => console.log(h))"
# Luego en psql:
# UPDATE users SET password_hash = '<hash>' WHERE email = 'tu@email.com';
```

### Invalidar todas las sesiones activas de un usuario

```sql
UPDATE users SET invalidate_sessions_before = EXTRACT(EPOCH FROM NOW())::bigint WHERE email = 'tu@email.com';
```
