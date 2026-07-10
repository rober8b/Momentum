# Momentum — Plan de Build (spec-driven)

> Secuencia, no fechas. Cada fase entrega algo verificable contra su spec. No se avanza de fase sin que los criterios de aceptación de la anterior pasen.

## Orden de construcción

### Fase 0 — Congelar el contrato de campos (bloqueante)
Sin esto, todo lo demás se construye sobre arena.
- Implementar el schema `FieldDef` + Zod (FIELDS_AND_VIEWS §2).
- Implementar derivación de vistas disponibles desde `fields` (§3).
- Tests: criterios de aceptación de FIELDS_AND_VIEWS §4.
- **Salida verificable:** dado un `FieldDef[]` cualquiera, el sistema dice qué vistas hay, sin código por-pilar.

### Fase 1 — Vistas genéricas sobre el contrato
- `list` y `table` (fallbacks universales) primero.
- `kanban` (derivado de `status`).
- `calendar`/`timeline` (derivado de `date`) — puede quedar para 1.5 si aprieta.
- `grid` para pilares con imagen/número.
- **Salida verificable:** puedo crear un pilar a mano con campos arbitrarios y se ve bien en su vista derivada.

### Fase 2 — Onboarding Puerta A (brief por texto)
La puerta más simple y la que valida la tesis.
- `inferPillars(brief)` → `PillarPlan[]` con validación dura.
- Preview editable.
- `materializeOnboarding` ajustado al nuevo contrato.
- Tests: ONBOARDING_GENERATIVE §8 (los que aplican a Puerta A).
- **Salida verificable:** escribo 3 frases y tengo mis pilares en < 2 min. **Este es el momento ajá — si acá no emociona, algo está mal en la tesis, no en el código.**

### Fase 3 — Puerta C (Obsidian import)
Reusa todo lo de la Fase 2; solo cambia el productor del brief.
- Lectura de estructura de vault → brief estructurado → `inferPillars`.
- Cierra el loop con el export que ya existe.

### Fase 4 — Puerta B (MCP)
Última porque es la más compleja en auth y la de menor alcance inicial.
- Versión mínima: pegar output del agente.
- Después: flujo MCP pulido reusando API v1.

### Fase 5 — Reconexión de subsistemas cross-cutting
Today, search, limits, export ya existen pero asumen shapes legacy.
- Reapuntarlos al motor dinámico + contrato de campos.
- Today: aggregator que lee `status`/`date` de cualquier pilar, no de tablas fijas.

## Qué RECORTAR del scope actual (simplificar)

El doc de estado muestra una app sobre-construida para su etapa. Recortes sugeridos:

1. **Los 7 pilares hardcodeados como producto** → degradar a *un template de ejemplo* entre varios. Dejan de ser el centro. Esto es recorte conceptual, no borrado de código: `lib/pillar-templates.ts` pasa a ser "templates semilla opcionales".
2. **Las 8 tablas de pilares legacy** → son red de rollback, no producto. No invertir un minuto más en ellas salvo para el corte final. Idealmente, el producto nuevo se construye asumiendo que van a morir.
3. **Vistas custom (schedule de Uni)** → NO son MVP. Son excepciones del caso fundador. Sacar del camino crítico; volver solo si un usuario real las pide.
4. **Billing/Polar, plan limits, admin, OAuth** → ya están hechos y andan. No tocar. Pero tampoco son diferenciadores — no gastar energía nueva ahí hasta tener el onboarding brillando.
5. **API v1 completa** → mantener solo lo que la Puerta B necesita. El resto puede esperar demanda real.

Regla de recorte: **todo lo que no sirva al time-to-structure o al momento ajá se congela, no se expande.**

## El riesgo operacional que NO desaparece con este plan

(Del doc original, sigue vigente y es lo más peligroso.)
`pillar_items` está vacía en prod; prod corre 100% legacy vía flags. Un deploy que active los flags dinámicos sin correr las migraciones `migrate-*` + `0005` rompe los pilares para todos al instante. **No hay guard en código.** Antes de cualquier deploy del motor nuevo:
1. Flags en `false` en Vercel.
2. Correr `0005` + `migrate-*` supervisados contra Railway.
3. Verificar round-trip.
4. Backup.
5. Recién ahí, flags en `true`, de a uno.

Recomendación fuerte: **poner un guard en código** que impida servir vistas dinámicas si `pillar_items` está vacía para un user que debería tenerla — convertir la seguridad procedural en técnica. Es una tarde de trabajo y elimina el riesgo #1 del proyecto.
