# Spec — Onboarding Generativo

> **Estado:** propuesta para revisión. Reemplaza el diseño viejo de `docs/GENERATIVE_ONBOARDING.md` (que además ya estaba desactualizado en su header).
> **Por qué existe:** es el producto. El momento ajá vive acá. Todo lo demás es la app que se disfruta *después* de que esto funcionó.
> **Depende de:** FIELDS_AND_VIEWS (el contrato de salida). **Es dependido por:** el resto de la app.

## 1. Objetivo

Llevar a un usuario nuevo de cero a un sistema de pilares que refleja su vida, en **< 2 minutos**, sin página en blanco. Tres puertas de entrada, un solo destino.

```
[Puerta A: Brief texto]  ┐
[Puerta B: MCP Claude]   ┼──► inferPillars() ──► preview editable ──► materializeOnboarding() ──► DB
[Puerta C: Obsidian]     ┘         │
                                    └── produce PillarPlan[] (contrato único)
```

Las tres puertas convergen en el mismo contrato intermedio: `PillarPlan[]`. Eso mantiene la inferencia desacoplada del origen del input.

## 2. Contrato de salida: `PillarPlan`

Lo que la inferencia produce, independientemente de la puerta. Se valida con Zod antes del preview.

```ts
interface PillarPlan {
  key: string;              // slug único
  name: string;             // libre
  icon: string;             // nombre lucide sugerido
  rationale: string;        // por qué la IA lo propuso (se muestra al user)
  fields: FieldDef[];       // contrato de FIELDS_AND_VIEWS (tipos cerrados)
  defaultView: ViewType;    // derivada de fields, una de las disponibles
  seedItems?: SeedItem[];   // 0–5 items de ejemplo pre-cargados (opcional)
}
```

**Regla dura:** `fields` debe validar contra el schema de FIELDS_AND_VIEWS. Un plan con un campo de tipo inválido se rechaza *antes* de mostrarse al usuario — la IA no puede romper el contrato de campos.

## 3. Puerta A — Brief por texto

**Input:** 2–4 frases libres. Ej: *"Soy estudiante de fintech, freelanceo como dev, y construyo una startup de pagos con IA."*

**Comportamiento:**
1. La IA recibe el brief + el prompt de sistema que le da el catálogo de tipos y ejemplos.
2. Devuelve `PillarPlan[]` (típicamente 3–6 pilares).
3. Se valida con Zod. Si un plan no valida, se descarta ese pilar (no se aborta todo).
4. Se muestra preview.

**Criterio de calidad:** el brief de ejemplo de arriba debería producir algo como pilares de Estudio, Freelance, y Startup — no los 7 del fundador por default. Si el output ignora el brief y devuelve un template fijo, es un bug.

## 4. Puerta B — MCP con Claude Code

**Input:** el usuario conecta su Claude Code vía MCP. El agente ya tiene contexto (proyectos, archivos, historial).

**Comportamiento:**
1. Momentum expone (o consume) una tool MCP que pide al agente un "brief estructurado del usuario".
2. El agente responde con el mismo formato de brief que la Puerta A (texto rico), o directamente con `PillarPlan[]` si se le da el schema.
3. A partir de ahí, idéntico a Puerta A: validar → preview → materializar.

**Nota de arquitectura:** ya existe un MCP server en otro repo que consume la API v1. Esta puerta puede reusar ese canal. La API v1 (`mmt_<hex>` bearer) es el transporte; el onboarding es el consumidor.

**Fuera de scope v1:** auth flow completo del MCP. Para el MVP alcanza con que un usuario técnico pueda pegar el output de su agente. El pulido viene después.

## 5. Puerta C — Conexión a Obsidian

**Input:** el usuario apunta a su vault (o un subset de carpetas).

**Comportamiento:**
1. Se lee la estructura del vault: carpetas top-level, tags frecuentes, frontmatter recurrente.
2. La IA infiere pilares a partir de esa estructura (una carpeta `/uni` con notas de materias → pilar de estudio con campo status).
3. El frontmatter recurrente sugiere campos (ej. `deadline:` en muchas notas → campo `date`).
4. Idéntico desenlace: `PillarPlan[]` → validar → preview → materializar.

**Relación con export:** Momentum ya exporta al vault (cron `/api/export`). La Puerta C es el camino inverso: *importar* estructura. Cierra el loop bidireccional.

## 6. Preview editable (paso común, crítico)

Nunca se materializa a ciegas. Después de la inferencia:
- Se muestran los pilares propuestos con su `rationale`, campos y vista.
- El usuario puede: renombrar, borrar un pilar, borrar/editar un campo, cambiar la vista sugerida, editar seed items.
- Botón único: **Confirmar** → `materializeOnboarding`.

El preview es donde la confianza se gana. Un usuario que ve *por qué* la IA propuso cada pilar y puede tocarlo, confía. Uno al que le aparecen 6 pilares de la nada, no.

## 7. `materializeOnboarding` (ya existe, se ajusta)

- Recibe `PillarPlan[]` confirmado.
- Instancia filas en `pillars` + `pillar_items` (seed items) para el user.
- Idempotente respecto al onboarding: correr dos veces no duplica.
- Server action, Zod en la frontera, `revalidatePath`.

## 8. Criterios de aceptación

- [ ] Las 3 puertas producen `PillarPlan[]` válido contra el schema de campos.
- [ ] El brief de ejemplo del §3 NO devuelve los 7 pilares del fundador; devuelve pilares acordes al brief.
- [ ] Un `PillarPlan` con un campo de tipo inválido se descarta en validación y no llega al preview.
- [ ] El preview permite editar/borrar pilares y campos antes de confirmar.
- [ ] Confirmar materializa en DB; correr el flujo dos veces no duplica.
- [ ] Puerta C: un vault con carpeta `/proyectos` produce al menos un pilar relacionado.
- [ ] Time-to-structure medido (evento de telemetría desde "empecé onboarding" hasta "confirmé") < 2 min en el happy path.
- [ ] Si la inferencia falla del todo (IA caída, timeout), hay fallback a un set de templates elegibles a mano — nunca página en blanco.

## 9. Riesgos y decisiones abiertas

- **Determinismo de la IA:** dos briefs iguales pueden dar pilares distintos. Aceptable, pero el preview mitiga. Considerar `temperature` baja para la inferencia.
- **Puerta B auth:** el flujo MCP completo es complejo; para MVP, versión mínima.
- **Calidad de campos generados:** el riesgo no es que la IA invente pilares, es que invente *malos campos*. Mitigación: prompt con ejemplos fuertes + validación dura + preview editable.
