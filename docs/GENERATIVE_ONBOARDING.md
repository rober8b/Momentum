# Generative Onboarding — Diseño

> Estado: **FASE 1 — diseño aprobado (pendiente)**  
> Implementación: Fases 2a–2e, después de OK de Rober.

---

## Objetivo

El usuario nuevo NO arranca con una grilla vacía. La app le hace 2–3 preguntas y le propone una estructura concreta: qué pillars activar, con qué items de arranque. El usuario revisa y confirma antes de que se cree nada en la DB.

Sentimiento target: **"la app ya me entendió antes de que yo escribiera nada"**.

---

## El flujo conversacional

### Cuántas preguntas

**2–3 preguntas para la mayoría de los usuarios. Máximo 4 (solo si eligió uni + freelance).**

| Paso | Nombre | Condicional |
|------|--------|------------|
| 1 | Contexto | Siempre (pregunta única de arranque) |
| 2 | Áreas | Siempre (multi-select, pre-seleccionado desde paso 1) |
| 3 | Detalle | Solo si seleccionó `uni` o `freelance` (jerarquías que necesitan contar contenedores) |
| Preview | Review editable | Siempre |

El Paso 3 es condicional, no numerado para el usuario — se siente como parte del flujo, no como un paso extra.

---

## Paso 1 — Contexto

**Pregunta:** "¿cómo es tu semana típica ahora mismo?"

**UI:** pantalla entera, 5 chips grandes de selección única. Fondo oscuro, accent naranja en el seleccionado.

| Opción | Key | Pre-selección para Paso 2 |
|--------|-----|--------------------------|
| "principalmente estudiante" | `student` | `uni`, `community`, `projects` |
| "trabajo en empresa / en relación de dependencia" | `developer` | `work`, `projects`, `build` |
| "trabajo con clientes propios (freelance)" | `freelancer` | `freelance`, `work`, `projects` |
| "construyo proyectos y comparto online" | `builder` | `projects`, `build`, `community` |
| "una mezcla de todo lo anterior" | `mix` | todos los 6 pre-seleccionados |

**Avance:** click en chip → avance automático con transition (0.3s delay para que el usuario vea el seleccionado antes de ir al paso siguiente).

---

## Paso 2 — Áreas

**Pregunta:** "¿qué querés tener bajo control en Momentum?"

**UI:** 6 chips de selección múltiple (toggle), pre-seleccionados según el contexto. CTA: botón "continuar →" (habilitado con al menos 1 área seleccionada).

| Chip | Área key | Template | Descripción visible |
|------|----------|----------|---------------------|
| "trabajo laboral" | `work` | WORK_TEMPLATE | tickets, tareas, reviews |
| "universidad" | `uni` | UNI_TEMPLATE | materias y TPs |
| "clientes freelance" | `freelance` | FREELANCE_TEMPLATE | clientes y sus tareas |
| "proyectos propios" | `projects` | PROJECTS_TEMPLATE | side projects e ideas |
| "comunidad / eventos" | `community` | COMMUNITY_TEMPLATE | compromisos y organizaciones |
| "build-in-public" | `build` | BUILD_TEMPLATE | contenido e ideas |

**Botón "prefiero empezar vacío"** — link secundario debajo del CTA. Llama `completeOnboarding()` directamente y redirige a `/`. No crea nada.

---

## Paso 3 — Detalle (condicional)

Solo aparece si en Paso 2 se seleccionó `uni` y/o `freelance`. Son las dos estructuras jerárquicas (contenedores → hijos) donde el número de contenedores determina el scope de la propuesta.

Si eligió ambas: dos micro-preguntas en la misma pantalla.

### Sub-pregunta A (si `uni`)
"¿cuántas materias estás cursando este semestre?"

| Opción | Key | Contenedores propuestos |
|--------|-----|------------------------|
| "1 o 2" | `low` | 2 contenedores |
| "3 o 4" | `mid` | 3 contenedores |
| "5 o más" | `high` | 4 contenedores (cap en 4 para no abrumar) |

### Sub-pregunta B (si `freelance`)
"¿cuántos clientes activos manejás?"

| Opción | Key | Contenedores propuestos |
|--------|-----|------------------------|
| "1" | `one` | 1 contenedor |
| "2 o 3" | `few` | 2 contenedores |
| "4 o más" | `many` | 3 contenedores (cap en 3) |

**UI:** radio buttons grandes, sin chips — más claro para opciones con texto más largo. CTA: "continuar →".

---

## Preview — Review editable

**No es un "paso numerado"**. Es la pantalla clave: el usuario ve exactamente qué se va a crear.

### Layout

```
──────────────────────────────────────
  así podría arrancar tu Momentum
  ─────────────────────────────────────
  
  [Pillar card: TRABAJO]          ← colapsable
    vista: kanban
    items:
    ✎ revisar pendientes de la semana  [×]
    ✎ cerrar tickets de la sprint      [×]
    ✎ reunión de equipo                [×]
    + agregar item
  
  [Pillar card: PROYECTOS]
    vista: grilla
    items:
    ✎ proyecto en curso        [×]
    ✎ idea a explorar          [×]
    + agregar item
    
  [Pilar card: UNI]
    vista: schedule
    ▷ Materia 1 (editable)      [×]
        ✎ TP en curso           [×]
        ✎ parcial próximo       [×]
    ▷ Materia 2 (editable)      [×]
        ✎ entrega pendiente     [×]
    + agregar materia
  
  ──────────────────────────────────────
  [← volver a editar]   [así quiero empezar →]
──────────────────────────────────────
```

### Interacciones en preview

- **Renombrar contenedor** (sujeto, cliente): click en el título → inline text input. Aplica al confirmar o blur.
- **Renombrar item**: igual — inline edit.
- **Borrar item** (×): elimina del estado local. No hay undo.
- **Borrar pillar entero**: botón de trash en el header del pillar card (confirm inline, no modal — es solo pre-materialización).
- **Agregar item a un pillar**: abre un inline input simple (solo título, el resto se setea por defecto). No el FormDialog completo — el onboarding no es el lugar para eso.
- Los pillars con `config.childView` (uni, freelance) muestran los contenedores en una lista con `▷` para desplegar sus hijos. Los pillars flat (work, projects, community, build) muestran los items directamente.

### Lo que NO se puede editar en preview

- View type del pillar (viene del template, es la decisión correcta)
- Status de los items (se setea al primer estado no-terminal del workflow)
- Orden de los pillars (se puede cambiar después)

---

## Árbol de decisión: respuestas → estructura propuesta

### Función `inferStructure(answers: OnboardingAnswers): ProposedStructure`

Pura, determinística, sin efectos. Vive en `app/onboarding/inference.ts`.

#### Seed data por área

##### `work` → WORK_TEMPLATE (kanban)
3–4 leaf items (sin contenedores). Status inicial: primero non-terminal del workflow = `'backlog'`.

Títulos según contexto del Paso 1:
- `developer`: "revisar PRs pendientes", "actualizar tickets de la sprint", "cerrar issue bloqueado"
- `freelancer`: "revisar pendientes del cliente", "llamada de seguimiento semanal", "entrega de avance"
- `student` / `builder`: "tarea principal de la semana", "revisar pendientes", "armar to-do de mañana"
- `mix`: ídem `developer`

`fields`: `{ type: 'task', priority: 'med' }`

##### `uni` → UNI_TEMPLATE (custom/schedule)
Contenedores según `detail.subjectCount`:
- `low` (1-2): 2 contenedores, 1 hijo cada uno
- `mid` (3-4): 3 contenedores, 2 hijos cada uno
- `high` (5+): 4 contenedores, 1 hijo cada uno (cap total de hijos en 6)

Títulos contenedores: "Materia 1", "Materia 2", etc. — **explícitamente editables en preview** (se espera que el usuario los renombre).
Títulos hijos: "TP en curso", "parcial próximo", "entrega pendiente", "lectura obligatoria" (rotados).
`fields` contenedores: `{ semester: currentSemester(), schedule: [] }` donde `currentSemester()` devuelve el semestre actual en formato `'YYYY-N'` (ej. `'2026-1'`).
`fields` hijos: `{}`

##### `freelance` → FREELANCE_TEMPLATE (grid → kanban)
Contenedores según `detail.clientCount`:
- `one` (1): 1 contenedor, 2 hijos
- `few` (2-3): 2 contenedores, 2 hijos cada uno
- `many` (4+): 3 contenedores, 2 hijos cada uno

Títulos contenedores: "Cliente A", "Cliente B", etc. — **explícitamente editables en preview**.
Títulos hijos: "kickoff inicial", "revisión de avance", "entrega final", "bug crítico" (rotados entre clientes).
`fields` contenedores: `{ stack: '', next_step: 'definir alcance inicial' }`
`fields` hijos: `{ priority: 'med' }`

##### `projects` → PROJECTS_TEMPLATE (grid)
3 leaf items (sin contenedores). Status: `'active'`.

Títulos según contexto:
- `developer` / `builder`: "proyecto en curso", "idea a explorar", "side project en pausa"
- `student`: "proyecto de la facu", "idea para cuando tenga tiempo", "repositorio a retomar"
- `freelancer`: "producto propio", "idea de SaaS", "prototipo pendiente"
- `mix`: ídem `developer`

`fields`: `{ next_step: 'definir próximo paso', last_update: '' }`

##### `community` → COMMUNITY_TEMPLATE (list)
1 contenedor + 2 hijos (el contenedor es opcional-grouping, así que los hijos pueden existir sin él — pero para el onboarding conviene proponer uno).

Título contenedor: "Mi comunidad principal" — editable.
Títulos hijos: "compromiso próximo", "meetup o evento pendiente".
`fields` contenedor: `{ slug: 'my-community' }`
`fields` hijos: `{}`
Status hijos: `'pending'`

##### `build` → BUILD_TEMPLATE (custom)
4 leaf items (sin contenedores, siempre flat). Statuses variados para que se vea el pipeline real:

| Título | Status | fields.type |
|--------|--------|------------|
| "idea para esta semana" | `'idea'` | `'opinion'` |
| "borrador en progreso" | `'draft'` | `'project'` |
| "post a refinar antes de publicar" | `'draft'` | `'project'` |
| "algo que ya compartí" | `'published'` | `'project'` |

`fields` comunes: `{ platforms: ['x'] }`

#### Orden de los pillars en la propuesta

El orden sigue la selección del usuario en el Paso 2 (el primero en el array `areas` tiene `position: 0`). Esto respeta la intención implícita del usuario: lo que seleccionó primero probablemente le importa más.

#### Conteo de leaf items

```
totalLeafItems = suma de:
  - items directos de pillars flat (work, projects, community-hijos, build)
  - hijos bajo contenedores (uni-assignments, freelance-tasks)
```

Los contenedores NO cuentan (son `is_container: true`). Con las semillas definidas arriba, el rango típico es **6–24 leaf items**, muy por debajo del `FREE_LEAF_ITEM_LIMIT = 150`.

Si por alguna razón `totalLeafItems > FREE_LEAF_ITEM_LIMIT` (imposible con los caps actuales, pero defensivo): se trim desde el final de la lista de cada pillar hasta entrar en el límite. La preview muestra un aviso.

---

## Contratos de datos: respuestas → filas DB

### Paso de materialización

`materializeOnboarding(confirmedStructure: ConfirmedStructure): Promise<Result>`

**`confirmedStructure`** es el estado de la preview después de los edits del usuario:

```ts
type ConfirmedPillarItem = {
  title: string;
  status: string;
  fields: Record<string, unknown>;
  is_container: boolean;
  children: ConfirmedPillarItem[];  // solo contenedores tienen hijos
};

type ConfirmedPillar = {
  templateKey: keyof typeof PILLAR_TEMPLATES;
  items: ConfirmedPillarItem[];
};

type ConfirmedStructure = {
  pillars: ConfirmedPillar[];
};
```

### Mapeo a `pillars`

Por cada `ConfirmedPillar`:

```sql
INSERT INTO pillars (user_id, key, name, icon, description, position,
                     view_type, status_workflow, config, source_template)
SELECT
  $userId,
  template.key,
  template.name,       -- no personalizable en onboarding v1
  template.icon,
  template.description,
  $index,              -- posición = orden de selección en Paso 2
  template.view_type,
  template.status_workflow,
  template.config,
  template.key
```

Equivale a llamar `ensurePillarForUser(userId, PILLAR_TEMPLATES[templateKey])` (ya existe en `lib/pillar-writes.ts`).

### Mapeo a `pillar_items`

Por cada item en `ConfirmedPillar.items`:

```sql
-- Contenedores primero (para tener el ID antes de insertar hijos)
INSERT INTO pillar_items (user_id, pillar_id, parent_item_id, is_container,
                          title, status, fields, is_sample)
VALUES ($userId, $pillarId, NULL, true, $title, $status, $fields, false)

-- Hijos después, con parent_item_id = UUID del contenedor recién creado
INSERT INTO pillar_items (user_id, pillar_id, parent_item_id, is_container,
                          title, status, fields, is_sample)
VALUES ($userId, $pillarId, $containerId, false, $title, $status, $fields, false)
```

**`is_sample: false`** — estos son datos reales del usuario, no demo data. El flag `is_sample` solo es `true` para "cargar datos de muestra" en settings.

Función a usar: `insertPillarItem` de `lib/pillar-writes.ts` (ya soporta `isContainer`, `parentItemId`, `isSample`).

**Orden de inserción dentro de un pillar:** contenedores primero (secuencial), hijos después (paralelo entre contenedores con `Promise.all`). Los pillars entre sí pueden materializarse en paralelo.

### Al finalizar

1. `completeOnboarding()` → `user.settings.onboarding_completed = true`
2. `revalidatePath('/')` + `revalidatePath('/p')` + un `revalidatePath('/p/{key}')` por cada pillar creado
3. `redirect('/')` desde el cliente (via `router.push('/')` después de que la action retorne `ok: true`)

---

## Estados de UI

| Estado | Trigger | UI |
|--------|---------|-----|
| `questions` | inicial | pasos 1–3 con transiciones slide |
| `preview` | usuario llega al preview | cards editables, spinner en CTA |
| `materializing` | usuario clickea "así quiero empezar" | overlay con spinner encima del preview, no puede interactuar |
| `done` | materialización exitosa | redirect automático a `/` |
| `error` | action falla | toast de error + CTA permanece habilitado para reintentar |
| `skipped` | "prefiero empezar vacío" | llama `completeOnboarding()` → redirect a `/` |

### Idempotencia

`materializeOnboarding` verifica al inicio: si `user.settings.onboarding_completed === true`, retorna `{ ok: true }` sin tocar nada. Protege contra doble-submit.

`ensurePillarForUser` ya es find-or-create — si el pillar existe, no duplica.

---

## Gate de onboarding en la app

### `app/page.tsx` (ya existe)

```tsx
// Hoy:
const data = await getTodayData(user.id, user.settings.timezone);
return <TodayDashboard data={data} lang={user.settings.language} />;

// Después:
if (!user.settings.onboarding_completed) {
  return <OnboardingFlow lang={user.settings.language} />;
}
const data = await getTodayData(user.id, user.settings.timezone);
return <TodayDashboard data={data} lang={user.settings.language} />;
```

**¿Por qué en `/` y no en `/onboarding/page.tsx`?**

Opción A: redirect a `/onboarding` desde `/`.
Opción B: renderizar `<OnboardingFlow>` inline en `/` si `!onboarding_completed`.

Elegimos **Opción B** porque:
- No hace un round-trip extra de redirect.
- La URL se mantiene en `/` durante todo el onboarding — al completar, el usuario ya está en su home.
- No requiere tocar `proxy.ts`.
- Consistente con el patrón ya existente (`if (!user) return <PublicLanding />`).

---

## Componentes a crear

```
app/onboarding/
  OnboardingFlow.tsx         'use client' — orquesta pasos + estado del wizard
  inference.ts               puro, sin efectos — OnboardingAnswers → ProposedStructure
  types.ts                   tipos: OnboardingAnswers, ProposedStructure, ConfirmedStructure, etc.
  actions.ts                 (ya existe: completeOnboarding) + nuevo: materializeOnboarding
  
  steps/
    StepContext.tsx          Paso 1 — chips de contexto
    StepAreas.tsx            Paso 2 — multi-select de áreas
    StepDetail.tsx           Paso 3 — sub-preguntas condicionales (uni + freelance)
    PreviewStep.tsx          Preview editable — pillar cards con inline edit
    
  components/
    ProgressDots.tsx         Indicador de paso (dots, no números)
    PillarPreviewCard.tsx    Card de un pillar en la preview con items editables
    ItemRow.tsx              Fila de item editable + deletable dentro de la preview
```

La action `actions.ts` existente se amplía (no se reemplaza):

```ts
// NUEVO en app/onboarding/actions.ts
export async function materializeOnboarding(
  structure: ConfirmedStructure
): Promise<{ ok: true } | { ok: false; error: string }>
```

No se toca `app/p/actions.ts` — el onboarding usa `ensurePillarForUser` + `insertPillarItem` de `lib/pillar-writes.ts` directamente, igual que el import de la API v1.

### ¿Por qué NO reusar `instantiateTemplate` de `app/p/actions.ts`?

`instantiateTemplate` usa `requireUser()` (session cookie) — eso está bien. El problema es que es una action de a una por template, y el onboarding necesita:
1. Crear N pillars en una sola operación
2. Inmediatamente crear items bajo esos pillars
3. La position debe reflejar el orden de selección del usuario

No vale la pena hacer N llamadas secuenciales ni adaptar esa action. `materializeOnboarding` hace todo en una sola transacción conceptual.

---

## UX / Estilo

### Transiciones entre pasos

`motion/react` — mismo patrón que `FormDialog`:

```ts
// Forward: slide in desde la derecha
initial: { opacity: 0, x: 24 }
animate: { opacity: 1, x: 0 }
exit: { opacity: 0, x: -24 }
transition: { duration: 0.25 }
```

Usar `AnimatePresence` de `motion/react` con `mode="wait"`.

### Chips (pasos 1 y 2)

```
rounded-xl border border-border bg-surface-elev px-4 py-3
hover: border-accent text-accent
selected: border-accent bg-accent/10 text-accent
```

Mobile: chips en 2 columnas (grid-cols-2) para paso 1 (5 opciones), 2–3 col para paso 2. La opción "mezcla de todo" en paso 1 ocupa ancho completo.

### Layout del wizard

Mismo patrón que `/login` y `/setup`: `min-h-screen flex items-center justify-center`. Max-w-sm en mobile, max-w-md en el preview (que tiene más contenido).

### Back / Skip

- "← atrás" — link pequeño arriba a la izquierda, siempre visible desde paso 2
- "prefiero empezar vacío" — link texto pequeño en footer del wizard, disponible en TODOS los pasos (no solo al final)

---

## Tests (Fase 2e)

| Test | Qué verifica |
|------|-------------|
| `inference.test.ts` | `inferStructure` por cada combinación de contexto×áreas, verificando: templates correctos, counts de containers/leaf items, is_container explícito, fields presentes |
| `inference.test.ts` | Límite free: propuesta nunca excede `FREE_LEAF_ITEM_LIMIT` |
| `materializeOnboarding.test.ts` | Idempotencia: segunda llamada retorna ok sin duplicar |
| `materializeOnboarding.test.ts` | `is_container` seteado correctamente en cada item |
| `materializeOnboarding.test.ts` | `is_sample: false` en todos los items creados |
| `materializeOnboarding.test.ts` | `parent_item_id` apunta a un contenedor del mismo pillar |

---

## Lo que esta fase NO incluye (deliberadamente)

- **LLM/AI para la inferencia** — la inferencia es determinística y suficiente para v1. El hook para un LLM existe (la función `inferStructure` es pura y reemplazable), pero no depende de uno en esta fase.
- **Personalización profunda en el wizard** — no hay inputs de texto libres durante las preguntas. Los nombres de materias/clientes se editan en el preview, no en las preguntas.
- **Onboarding de usuarios nuevos vía invite** — el admin invita manualmente desde `/admin`. El onboarding que se construye acá aplica para todos los usuarios con `onboarding_completed: false`, incluyendo los creados por admin.
- **Re-onboarding** — no hay "reiniciar onboarding". El usuario puede agregar/borrar pillars después desde `/p`.
- **Selección de view type** — los defaults de los templates son los correctos para cada pillar. No vale la pena preguntar.

---

## Secuencia de implementación (Fases 2a–2e)

```
2a → Componentes de UI del wizard (pasos 1–3 + ProgressDots), sin lógica
2b → inference.ts: OnboardingAnswers → ProposedStructure (puro, sin DB)
2c → PreviewStep: preview editable del estado local (sin materializar)
2d → materializeOnboarding action + gate en app/page.tsx
2e → Tests: inference + materialización
```

Cada sub-fase es un PR independiente y revisable antes de continuar.
