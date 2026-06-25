# BILLING.md — Momentum

Polar (polar.sh) como Merchant of Record. Solo aplica en `MOMENTUM_MODE=hosted`.

---

## Overview

Polar cobra, gestiona IVA/impuestos, y envía webhooks que son la única fuente de verdad del plan del usuario.

**En `MOMENTUM_MODE=self_hosted` (default):** todas las vars `POLAR_*` quedan sin setear, `isPolarConfigured()` devuelve `false`, ningún cliente Polar se construye, el webhook route devuelve 404.

### Flujo de plan

```
Checkout Polar → webhook → users.plan / users.plan_status → checkLimit()
```

`users.plan` (`free` | `pro`) + `users.plan_status` (`active` | `past_due` | `cancelled`) son la fuente de verdad local. `checkLimit()` en `lib/limits.ts` los lee.

---

## Event → State mapping (webhooks)

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

`subscription.revoked` es el ÚNICO evento que baja el plan a `free`.

---

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `lib/polar.ts` | Client Polar (lazy), `isPolarConfigured()`, `getSiteUrl()` |
| `lib/polar-webhook.ts` | `resolvePolarEvent()` — función pura, testeable, mapea evento→plan |
| `app/settings/billing/actions.ts` | `createCheckoutSession()` + `openCustomerPortal()` |
| `app/api/webhooks/polar/route.ts` | Webhook handler — firma, despacha a `resolvePolarEvent`, update DB |
| `lib/limits.ts` | `checkLimit()` — lee `users.plan` para enforcer límites |
| `components/settings/UpgradeButton.tsx` | Botón upgrade para plan `free` |
| `components/settings/ManageBillingButton.tsx` | Botón portal para plan `pro` |
| `components/settings/PlanSection.tsx` | Renderiza plan/status/uso + botones según estado |

**`resolvePolarEvent` existe específicamente para ser testeable sin mockear el SDK de Polar ni la DB.** Si tocás el mapeo de eventos, tocás ese archivo y sus tests (`lib/polar-webhook.test.ts`) — no reinsertes el switch inline en la route.

---

## Setup en Polar

### Sandbox (primero)

1. Crear organización en `https://sandbox.polar.sh`
2. Crear producto recurrente "Pro" → copiar el Product ID → `POLAR_PRO_PRODUCT_ID`
3. Crear Organization Access Token → `POLAR_ACCESS_TOKEN`
4. En Webhooks, crear endpoint apuntando a `<NEXT_PUBLIC_SITE_URL>/api/webhooks/polar`
5. Suscribir a `subscription.*` y `order.paid` → copiar el secret → `POLAR_WEBHOOK_SECRET`
6. Setear `POLAR_SERVER=sandbox` en las env vars

### Producción

1. Repetir los pasos en `https://polar.sh` (sin sandbox)
2. Cambiar `POLAR_SERVER=production`
3. Actualizar `POLAR_PRO_PRODUCT_ID`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET` con los valores de prod

---

## Variables de entorno requeridas (hosted)

| Var | Para qué |
|-----|----------|
| `POLAR_ACCESS_TOKEN` | Organization Access Token de Polar |
| `POLAR_PRO_PRODUCT_ID` | ID del producto "Pro" en Polar |
| `POLAR_WEBHOOK_SECRET` | Secret para verificar firma de webhooks |
| `POLAR_SERVER` | `sandbox` (default) o `production` |
| `NEXT_PUBLIC_SITE_URL` | URL base de la instancia (para redirects de checkout) |

---

## Plan limits

Para cambiar un número de límite: editar `PLAN_LIMITS.free` en `lib/plans.ts`. `pro` tiene `null` en todos los recursos (unlimited).

Enforced en:
- Server actions de creación — `checkLimit(user.id, resource)` antes del insert; si `allowed: false` devuelven `LimitReachedError`
- `/api/v1/import/*` — cada endpoint chequea el límite, calcula `remaining`, importa hasta ese tope; los items que exceden se reportan en `errors[]`
- `/settings/profile` — `PlanSection` muestra uso actual vs límite via `getUsageSummary()`
