# command-center

Personal daily dashboard for Rober — 3 pillars: **Universidad** (UCEMA) / **Trabajo** (Aleph) / **Build-in-public** (X + LinkedIn).

Exports completed items weekly to the Obsidian vault.

## Setup

```bash
# 1. Install deps
npm install

# 2. Provisionar Postgres en Railway
# https://railway.app → New Project → "Provision PostgreSQL"
# Copiar el DATABASE_URL desde la pestaña Variables al .env.local

# 3. Configurar auth (password + cookie firmada — sin servicios externos)
# Generar un SESSION_SECRET random de 32 bytes hex:
# Bash:        openssl rand -hex 32
# PowerShell:  -join ((0..63) | %{ '{0:x}' -f (Get-Random -Max 16) })
# Setear APP_PASSWORD con la password que vas a usar.

# 4. Configurar .env.local (copiar desde .env.example)
cp .env.example .env.local
# editar valores: DATABASE_URL, APP_PASSWORD, SESSION_SECRET

# 5. Aplicar el schema a Railway (dos opciones):

# OPCIÓN A: drizzle-kit push (recomendado para dev)
npx drizzle-kit push

# OPCIÓN B: correr la migración generada (mejor para prod)
# Conectarse al Postgres de Railway (psql o el SQL editor) y correr:
# - drizzle/0000_initial.sql

# 6. Seed inicial — las 5 materias UCEMA
# Correr drizzle/seed.sql contra la DB (psql o Railway SQL editor)

# 7. Dev
npm run dev
# → http://localhost:3000 → te redirige a /login → ingresá APP_PASSWORD
```

## Comandos Drizzle

```bash
npx drizzle-kit push        # Sincroniza schema con la DB (dev)
npx drizzle-kit generate    # Crea un .sql nuevo si cambió el schema (prod)
npx drizzle-kit studio      # GUI web para explorar la DB
```

## Verificación

Antes de declarar el MVP listo:

1. ✅ Login con Clerk desde una pestaña incógnito → ve la Today view
2. ✅ Crear clase en /uni con horario lunes 18:00. Crear assignment "TP1 Fintech" due en 3 días
3. ✅ Crear workblock en /work: "Onboarding Aleph - setup laptop", status `today`, priority `high`
4. ✅ Capturar idea de build desde Today: "Demo Catalog Crew para Twitter"
5. ✅ Volver a / (Today): los 3 items aparecen en sus secciones correctas
6. ✅ Marcar el workblock como done desde Today
7. ✅ Mover la idea a draft, escribir hook + cuerpo, mark as published con link
8. ✅ Disparar `/api/export` manualmente: verificar que devuelve JSON con `files` poblado
9. ✅ Probar mobile (iOS Safari): Today view usable con un solo pulgar

```bash
npm run typecheck  # 0 errors
npm run build      # 0 errors, 0 warnings de TS strict
```

## Deploy

```bash
# 1. Push a GitHub
git init
git add -A
git commit -m "feat: command-center MVP"
git remote add origin git@github.com:bd-rober/command-center.git
git push -u origin main

# 2. Vercel
# vercel.com/new → import repo → configurar env vars (mismo .env.local)
# DATABASE_URL → la misma de Railway (Railway expone una URL pública por proyecto)
# Custom domain: configurar en Vercel → Settings → Domains
```

Cron de export semanal: ya configurado en `vercel.json` (domingos 22:00 UTC).

## Email setup (opcional)

El envío de emails se usa para:
- Confirmación de cuenta (`REQUIRE_EMAIL_CONFIRMATION=true`)
- Reset de contraseña (`/forgot-password`)

### Sin credenciales (log-mode)

Si no seteás `RESEND_API_KEY`, la app entra en **log-mode**: los links se imprimen en la consola del servidor en vez de enviarse. Útil para desarrollo local.

```
[email:log-mode] to=user@example.com subject="resetear contraseña — command center"
[email:log-mode] link: http://localhost:3000/reset-password/abc123...
```

### Con Resend (producción)

1. Crear cuenta en [resend.com](https://resend.com)
2. Verificar un dominio tuyo (ej: `yourdomain.com`) — Resend te da los registros DNS a agregar
3. Setear las variables en `.env.local` y en Vercel:

```env
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com
```

> ⚠️ `EMAIL_FROM` debe ser una dirección de un dominio verificado en tu cuenta de Resend.
> **No uses el dominio del autor del repo** — no tenés permiso para enviar desde él.

### Confirmación de email obligatoria

Si activás `REQUIRE_EMAIL_CONFIRMATION=true`, `EMAIL_FROM` es **requerido** — la app falla al arrancar si no está seteado.

```env
REQUIRE_EMAIL_CONFIRMATION=true
EMAIL_FROM=noreply@yourdomain.com   # obligatorio cuando lo anterior es true
```

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16.2.6 + React 19.2.4 (App Router) |
| Styling | Tailwind CSS v4 |
| DB | **Railway Postgres** |
| ORM | **Drizzle ORM** (type-safe, schema-driven) |
| Auth | Password + cookie HMAC-firmada (single-user, sin servicios externos) |
| Deploy | Vercel |

## Notas

- ⚠️ Next.js 16 tiene breaking changes vs 14/15. Ver `AGENTS.md`. Usar `proxy.ts` (no `middleware.ts`).
- Single-user: `APP_PASSWORD` + `SESSION_SECRET` en `.env.local`. La verificación vive en `lib/auth.ts` (node:crypto) + `proxy.ts` (Web Crypto para Edge).
- Export semanal: V1 devuelve JSON con los archivos. V2 (opcional): subir a GitHub repo del vault via API.
- Schema: ver `lib/db/schema.ts` (Drizzle). Migraciones generadas: `drizzle/`. Seed: `drizzle/seed.sql`.
- Plan original: `~/.claude/plans/tengo-menos-de-1k-effervescent-pizza.md`.
