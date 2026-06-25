# BACKUPS.md — Momentum

Backup automático de la DB de Railway, encriptado, con verificación de restore en CI.

---

## Cómo funciona

`.github/workflows/db-backup.yml` corre **daily a las 03:00 UTC** (+ `workflow_dispatch` para correrlo a mano). Hace `pg_dump` de la DB de Railway, **verifica el restore en CI** (lo restaura contra un Postgres descartable antes de confiar en el backup), lo encripta con AES-256-CBC, y lo sube como artifact de GitHub Actions.

**Por qué encriptado:** este repo es **público** — los artifacts de GitHub Actions en repos públicos son descargables por cualquiera con la run URL, sin necesitar acceso de escritura al repo. El dump tiene datos reales (emails, password hashes, campos de billing de Polar), así que nunca se sube sin encriptar.

El paso `Verify restore into scratch DB` del workflow restaura el dump contra una DB temporal en CI. Si esa verificación falla, el job falla y no sube el backup — un backup que llegó a subirse ya pasó por un restore real al menos una vez.

---

## Setup (una sola vez)

En GitHub → repo → Settings → Secrets and variables → Actions, agregar:

| Secret | Valor |
|--------|-------|
| `DATABASE_URL` | la misma connection string pública de Railway que usa Vercel |
| `BACKUP_ENCRYPTION_KEY` | passphrase random — generar con `openssl rand -base64 32` |

**Guardar `BACKUP_ENCRYPTION_KEY` en un password manager.** Sin esa key, los backups encriptados son irrecuperables.

Si `DATABASE_URL` no está seteada, el job hace skip limpio sin fallar. Si falta `BACKUP_ENCRYPTION_KEY` pero sí está `DATABASE_URL`, el job **falla fuerte** (nunca sube un dump sin encriptar).

---

## Retención

Artifacts se retienen 30 días (`retention-days` en el workflow — ajustable ahí). GitHub los borra automáticamente al vencer — no hace falta limpieza manual.

---

## Restore — paso a paso

### 1. Descargar el artifact

Desde la run de GitHub Actions, o via CLI:

```bash
gh run download <run-id> -n db-backup-<fecha>
```

### 2. Desencriptar

```bash
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in backup-<fecha>.dump.enc \
  -out backup.dump \
  -pass pass:'<BACKUP_ENCRYPTION_KEY>'
```

⚠️ En Windows con Git Bash: agregar `MSYS_NO_PATHCONV=1` antes del comando si la path del archivo se expande incorrectamente:

```bash
MSYS_NO_PATHCONV=1 openssl enc -d -aes-256-cbc -pbkdf2 \
  -in backup-<fecha>.dump.enc \
  -out backup.dump \
  -pass pass:'<BACKUP_ENCRYPTION_KEY>'
```

### 3. Verificar primero (drill local)

Antes de tocar prod, restaurar contra la DB local descartable:

```bash
npm run db:up   # DB local Docker en localhost:5432
pg_restore --no-owner --no-privileges \
  -d "postgres://momentum:momentum@localhost:5432/momentum" \
  backup.dump
# Chequear que las tablas clave tengan data esperada
```

### 4. Restaurar en prod

- **DB nueva/vacía** (ej. Railway recién provisionado):
  ```bash
  pg_restore --no-owner --no-privileges -d "$DATABASE_URL" backup.dump
  ```
- **DB existente que se quiere sobreescribir** (recovery real, perdiste prod):
  ```bash
  pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" backup.dump
  ```

### 5. Re-aplicar migraciones pendientes (si el backup es anterior a migraciones nuevas)

```bash
npm run db:migrate   # con DATABASE_URL apuntando a la DB recién restaurada
```

---

## Drill — verificación periódica recomendada

Correr el restore drill contra la DB local cada 30 días para confirmar que el proceso funciona antes de necesitarlo en una emergencia real. Los pasos son los del "Verificar primero" de arriba — toma ~5 minutos.
