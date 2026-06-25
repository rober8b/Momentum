# AUTH.md — Momentum

Flujo de auth exhaustivo, setup inicial, invalidación de sesiones, y `user.settings`.

---

## Archivos críticos

| Archivo | Runtime | Rol |
|---------|---------|-----|
| `lib/auth.ts` | Node | `requireUser()`, `signSession()`, `verifySession()`, `hashPassword()`, `verifyPassword()` |
| `proxy.ts` | Edge (Web Crypto) | Primera línea de defensa — verifica cookie antes de llegar al handler |

**No modificar ninguno de estos sin avisar** — son los archivos más sensibles del proyecto.

---

## Setup inicial (primera vez)

1. Con DB vacía, `/setup` (ruta pública) muestra el wizard de creación del primer admin
2. `setupAction` crea el usuario con `hashPassword(password)` (bcrypt, 12 rounds) y `role: 'admin'`
3. Post-setup → redirect a `/login`

Alternativamente via API: `POST /api/v1/setup` (ver `docs/API.md`).

---

## Login flow

1. POST email + password al server action `loginAction`
2. `SELECT * FROM users WHERE email = ? LIMIT 1`
3. `verifyPassword(input, user.password_hash)` — bcrypt compare, timing-safe
4. Si match → `signSession(userId)` genera cookie: `{userId}.{iat}.{hmac(userId.iat)}`
   - HMAC: SHA-256 sobre `"userId.iat"` usando `SESSION_SECRET`
   - `iat` = unix timestamp en segundos (habilita invalidación temporal por usuario)
5. Cookie `momentum_session` seteada: HttpOnly, SameSite=Lax, Secure en prod, expires 30d
6. Redirect a `next` param (validado que empiece con `/` y no `//`)

---

## Request flow — protección en dos capas

**Capa 1 — `proxy.ts` (Edge runtime, Web Crypto):**

1. Request entra → `proxy.ts`
2. Path matchea `/login`, `/setup`, `/reset-password`, etc., o `/api/export` (cron), o `/api/v1/*` → pasa sin verificar cookie
3. `/signup` → solo pasa si `ALLOW_SIGNUP=true`, sino 404
4. Lee cookie `momentum_session` → verifica HMAC con `SESSION_SECRET` via `crypto.subtle`
5. Cookie inválida o ausente → redirect a `/login?next=<original>`
6. Cookie válida → continúa al handler

**Capa 2 — `requireUser()` en `lib/auth.ts` (Node runtime, `node:crypto`):**

7. Server Component / Server Action llama `requireUser()`
8. Re-verifica HMAC + consulta DB: busca user por `userId`, chequea `active` y `invalidate_sessions_before`
9. Si no auth → throw `'NOT_SIGNED_IN'` (Next captura como error)
10. Retorna `User` completo con `settings: UserSettings` mergeado con defaults

---

## Logout

`/logout` route handler (acepta GET y POST) → `cookies().delete(COOKIE_NAME)` → redirect a `/login`.

---

## Invalidación de sesiones

### Por usuario (sin afectar a otros)

`users.invalidate_sessions_before` (unix timestamp). Setear este campo invalida todas las sesiones anteriores de ese usuario sin afectar a otros. Útil para "cerrar todas las sesiones activas".

```sql
UPDATE users SET invalidate_sessions_before = EXTRACT(EPOCH FROM NOW())::bigint
WHERE email = 'tu@email.com';
```

### Global (todos los usuarios)

Rotar `SESSION_SECRET` = invalida TODAS las cookies de TODOS los usuarios. Equivale a logout forzado global.

---

## user.settings

Cada usuario tiene `settings: jsonb` con tipo `UserSettings` de `lib/types.ts`:

```ts
type UserSettings = {
  timezone: string;         // IANA tz, e.g. 'America/Argentina/Buenos_Aires'. Default: 'UTC'
  language: 'en' | 'es';   // UI language. Default: 'en'
  theme: 'dark' | 'light'; // UI theme. Default: 'dark'
  export_enabled: boolean;  // Participar en cron semanal de vault export. Default: false
  vault_path: string;       // Path base en el vault Obsidian. Default: ''
};
```

- `requireUser()` siempre retorna user con `DEFAULT_USER_SETTINGS` mergeado — nunca undefined en ningún campo.
- Editar settings: `app/settings/profile/` (UI) + `app/settings/profile/actions.ts`.
- `vault_path` se usa en el cron de export como prefijo de los paths generados.

---

## Rate limiting de login

Tabla `login_attempts` — rate limit por IP. 5 intentos fallidos por 15 minutos por IP. Registros viejos se limpian automáticamente.

---

## Agregar un nuevo usuario (multi-user)

Por ahora no hay flujo de invite público. Opciones:

1. Habilitá `/signup` temporalmente con `ALLOW_SIGNUP=true` en env
2. Desde admin panel (`/admin`) si está implementado
3. Directo a DB: insertar con `password_hash` generado por bcrypt (ver runbook en `docs/DATABASE.md`)
