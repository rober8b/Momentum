# ENV.md — Momentum

Variables de entorno, archivos `.env`, y guía de deploy a producción.

---

## Variables de entorno

| Var | Para qué | Requerido | Ejemplo |
|-----|----------|-----------|---------|
| `DATABASE_URL` | Conn string a Railway Postgres | siempre | `postgres://user:pass@host:port/db` |
| `SESSION_SECRET` | HMAC secret para firmar cookies de sesión | siempre | (32 bytes hex) |
| `NEXT_PUBLIC_SITE_URL` | URL base de la instancia | prod (recomendado) | `https://momentum.tudominio.com` |
| `CRON_SECRET` | Bearer token para autenticar el cron de Vercel | prod | (string random) |
| `ALLOW_SIGNUP` | Habilitar ruta `/signup` públicamente | opcional | `true` |
| `MOMENTUM_MODE` | `self_hosted` (default, unlimited) o `hosted` (límites freemium) | opcional | `hosted` |
| `POLAR_ACCESS_TOKEN` | Organization Access Token de Polar | solo `hosted` | `pat_...` |
| `POLAR_PRO_PRODUCT_ID` | ID del producto "Pro" en Polar | solo `hosted` | `prod_...` |
| `POLAR_WEBHOOK_SECRET` | Secret para verificar firma de webhooks de Polar | solo `hosted` | (string random) |
| `POLAR_SERVER` | `sandbox` o `production` | solo `hosted` | `production` |
| `VAULT_REPO_OWNER` | Owner del repo del vault (export v2) | post-MVP | `bd-rober` |
| `VAULT_REPO_NAME` | Nombre del repo del vault (export v2) | post-MVP | `obsidian-vault` |
| `GITHUB_TOKEN` | PAT con scope `repo` (export v2) | post-MVP | `ghp_...` |

### Generar `SESSION_SECRET`

```bash
# Bash / WSL / Git Bash
openssl rand -hex 32

# PowerShell
-join ((1..64) | %{ '{0:x}' -f (Get-Random -Max 16) })
```

---

## Archivos de env

| Archivo | Para qué | Commiteado |
|---------|----------|------------|
| `.env.example` | Plantilla documentada con todas las vars (sin valores reales) | Sí |
| `.env.local` | Vars locales de desarrollo | No (`.gitignore`) |

**Nunca commitear `.env.local`.** Ya está en `.gitignore` pero el riesgo es real.

Para dev local, copiar `.env.example` a `.env.local` y completar. Como mínimo:

```bash
DATABASE_URL=postgres://momentum:momentum@localhost:5432/momentum
SESSION_SECRET=<32 bytes hex — generá uno>
```

---

## Deploy a producción — paso a paso

### 1. Railway — DB

1. Ir a `https://railway.app` → New Project → Provision PostgreSQL
2. Copiar `DATABASE_URL` desde Variables (habilitar public networking si Vercel lo necesita)

### 2. GitHub

```bash
git remote add origin git@github.com:rober8b/Momentum.git
git push -u origin master
```

### 3. Vercel

1. `vercel.com/new` → importar repo desde GitHub
2. Setear env vars en Vercel → Settings → Environment Variables:
   - `DATABASE_URL` → la URL pública de Railway
   - `SESSION_SECRET` → generar uno nuevo (distinto al local)
   - `CRON_SECRET` → string random (ej. `openssl rand -hex 32`)
   - `NEXT_PUBLIC_SITE_URL` → el dominio final (o el `.vercel.app` por ahora)
3. Deploy — Vercel corre `vercel-build` (= `db:migrate && next build`) automáticamente

### 4. Custom domain

Vercel → Settings → Domains → agregar dominio y configurar CNAME en tu DNS.

### 5. GitHub Secrets (para backups)

Agregar `DATABASE_URL` y `BACKUP_ENCRYPTION_KEY` en GitHub → repo → Settings → Secrets and variables → Actions. Ver `docs/BACKUPS.md`.

### 6. Verificar cron

Vercel dashboard → Settings → Crons → debería aparecer `/api/export` con schedule `0 22 * * 0` (domingos 22:00 UTC).

### 7. Primer admin

Con la instancia en prod, ir a `<URL>/setup` o usar `POST /api/v1/setup`. Ver `docs/AUTH.md`.

---

## Variables de entorno en Vercel

Vercel distingue tres entornos: **Production**, **Preview**, y **Development**.

- `DATABASE_URL` de Railway va en **Production** (y opcionalmente Preview si usás una DB separada de staging).
- Variables sensibles (`SESSION_SECRET`, `CRON_SECRET`, `POLAR_*`) van en **Production**.
- El entorno **Development** de Vercel no se usa — usás `.env.local` directamente con Docker local.

Para sincronizar env vars locales contra Vercel (si instalaste el CLI):
```bash
vercel env pull .env.local   # baja las vars de Preview a tu .env.local
```

---

## Motor dinámico — flags en prod

⚠️ **Antes de cualquier deploy a prod con el motor dinámico:** los flags `*_DYNAMIC_ENGINE` son `ON` por default. Si `pillar_items` está vacía en prod (nunca se corrieron los `migrate-*` scripts), todos los pilares se renderizan vacíos para todos los usuarios al instante.

**Procedimiento seguro de cutover a prod:**
1. Setear los 6 flags en `false` en Vercel env (`PROJECTS_DYNAMIC_ENGINE=false`, etc.)
2. Hacer deploy normal — el código llega a prod usando el path legacy
3. Correr migración 0005 contra Railway
4. Correr los scripts `migrate-*` contra Railway supervisado
5. Verificar round-trip, hacer backup fresco
6. Prender los flags uno por uno, verificando cada pilar

Ver `docs/DYNAMIC_PILLARS.md` para el plan completo.
