# Correcciones de docs y comentarios desactualizados

Reemplazá los headers/comentarios viejos por estos. El cuerpo de cada doc se revisa aparte; esto corrige lo que activamente miente sobre el estado.

---

## 1. `docs/GENERATIVE_ONBOARDING.md` — header

**Viejo (borrar):**
> FASE 1 — diseño aprobado (pendiente) / Implementación: Fases 2a–2e después de OK de Rober

**Nuevo:**
```
> Estado: IMPLEMENTADO y commiteado (commit 296313f). Local, no en prod.
> Este doc describía el diseño original. La spec vigente del comportamiento
> es docs/spec/ONBOARDING_GENERATIVE.md, que reencuadra el onboarding como
> generativo multi-puerta (brief / MCP / Obsidian) y es la fuente de verdad.
> Este archivo queda como registro histórico del diseño inicial.
```

---

## 2. `docs/DYNAMIC_PILLARS.md` — header

**Viejo (borrar):**
> Phase 0 in progress (Sprint B) — proven on Projects first, no cutover yet

**Nuevo:**
```
> Estado: los 7 pilares están migrados al motor dinámico (LOCAL). Prod sigue
> 100% legacy (pillar_items vacía en Railway — ver riesgo operacional en
> docs/BUILD_PLAN.md). El contrato de campos que faltaba está en
> docs/spec/FIELDS_AND_VIEWS.md. El cutover a prod es procedural y todavía
> no ocurrió.
```

---

## 3. `docs/SAAS_ROADMAP.md` — dos correcciones

**Corrección A — S7 (plans & limits):**
> Viejo: "in progress"
> Nuevo: "DONE — rediseñado en Sprint 11 (FREE_LEAF_ITEM_LIMIT=150 cross-pilar, contenedores nunca bloqueados)."

**Corrección B — S9 (billing):**
> Viejo: "Stripe billing"
> Nuevo: "Polar billing (Merchant of Record). La app NO usa Stripe. Webhook = única fuente de verdad, mapeo testeado en lib/polar-webhook.ts."

---

## 4. `lib/db/schema.ts:374-377` — comentario

**Viejo (borrar):**
> Additive, not yet read/written by the app... proven on Projects first, no cutover yet

**Nuevo:**
```ts
// pillars + pillar_items: motor dinámico. LEÍDO Y ESCRITO por la app (local)
// vía flags en lib/pillar-flags.ts (default ON). Las tablas legacy son la red
// de rollback y siguen siendo fuente de verdad SOLO en prod (Railway), donde
// pillar_items está vacía hasta correr migrate-* + 0005. Ver docs/BUILD_PLAN.md.
```

---

## 5. `app/p/page.tsx:13-15` — comentario

**Viejo (borrar):**
> Sprint B Phase 1 proof page... Not linked from the sidebar yet

**Nuevo:**
```ts
// Ruta principal del motor de pilares dinámico. Renderiza los pilares del user
// desde pillar_items. Ver docs/spec/FIELDS_AND_VIEWS.md para el contrato de
// campos/vistas y docs/spec/ONBOARDING_GENERATIVE.md para cómo se generan.
```
