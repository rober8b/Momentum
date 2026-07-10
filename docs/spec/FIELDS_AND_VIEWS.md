# Spec — Sistema de Campos y Vistas

> **Estado:** propuesta para revisión.
> **Por qué existe:** es el cuello de botella real del producto. El onboarding puede inventar cualquier pilar, pero un pilar solo se siente bien si tiene una vista que lo renderiza con sentido. Esta spec define el contrato que hace posible que la IA genere estructuras arbitrarias que igual se ven bien.
> **Depende de:** nada. **Es dependido por:** ONBOARDING_GENERATIVE, y todo subsistema cross-cutting (Today, search, limits).

## 1. Principio central

**La IA inventa libremente el nombre y el propósito de cada campo, pero NO su tipo.**
Los tipos salen de un catálogo cerrado. Los nombres/keys/opciones son libres.

Esto da flexibilidad total de *contenido* (cada usuario su universo) con renderizabilidad garantizada (toda vista sabe qué hacer con cada tipo). Sin esto, el producto se rompe en el segundo pilar raro.

## 2. Catálogo de tipos de campo (primitivas)

Contrato cerrado. La IA elige `type` de esta lista y nada más.

| type          | descripción                          | render base        | usado por vista |
|---------------|--------------------------------------|--------------------|-----------------|
| `text`        | string corto (título, nombre)        | input línea        | todas           |
| `longtext`    | texto largo (notas, descripción)     | textarea           | detail          |
| `number`      | numérico (opcional unit, min, max)   | input numérico     | grid, chart     |
| `date`        | fecha (opcional con hora)            | date picker        | calendar, timeline |
| `status`      | enum de estados con orden y color    | pill / columna     | **kanban**      |
| `select`      | 1 opción de lista cerrada            | dropdown           | filtro, grid    |
| `multiselect` | N opciones de lista cerrada          | chips              | filtro          |
| `url`         | link (opcional label)                | anchor             | list, grid      |
| `checkbox`    | booleano                             | toggle             | list            |
| `relation`    | referencia a otro pillar_item        | link a item        | detail          |

Reglas:
- `status`, `select`, `multiselect` traen `options: [{ key, label, color?, order? }]`. La IA define las opciones libremente.
- `status` es especial: es el único que habilita kanban. Un pilar puede tener a lo sumo **un** campo `status` (el discriminador de columnas).
- `text` marcado `isTitle: true` es obligatorio y único por pilar — es lo que se muestra como nombre del item en toda vista.

### Field schema (forma canónica)

```ts
type FieldType =
  | "text" | "longtext" | "number" | "date"
  | "status" | "select" | "multiselect"
  | "url" | "checkbox" | "relation";

interface FieldDef {
  key: string;            // libre, slug único dentro del pilar
  label: string;          // libre, human-readable
  type: FieldType;        // del catálogo cerrado
  isTitle?: boolean;      // exactamente uno por pilar
  required?: boolean;
  options?: OptionDef[];  // solo status/select/multiselect
  unit?: string;          // solo number
}
interface OptionDef { key: string; label: string; color?: string; order?: number; }
```

Este schema es la **frontera de validación**: la salida del onboarding se valida con Zod contra esto antes de tocar DB. Si no valida, no se materializa.

## 3. Vistas: se derivan de los tipos presentes

La vista NO se elige a mano ni la inventa la IA. **Se deriva de los campos.** Regla de disponibilidad:

| vista      | condición para estar disponible                          |
|------------|----------------------------------------------------------|
| `list`     | siempre (fallback universal)                             |
| `kanban`   | existe un campo `status`                                 |
| `grid`     | existe `isTitle` + (al menos un `url` imagen o `number`) |
| `calendar` | existe al menos un campo `date`                          |
| `timeline` | existe al menos un campo `date`                          |
| `table`    | siempre (muestra todos los campos en columnas)           |

- La IA sugiere una `defaultView` entre las disponibles; el usuario puede cambiarla.
- **Vistas custom registradas en código** (ej. schedule semanal de Uni) siguen existiendo como renderers especiales, opt-in por `pillar.config.customRenderer`. No son parte del contrato generativo — son excepciones declaradas.

## 4. Criterios de aceptación

- [ ] Dado cualquier `FieldDef[]` que valide contra el schema, el sistema deriva el set de vistas disponibles sin código específico del pilar.
- [ ] Un pilar con un campo `status` renderiza kanban correcto (columnas = options del status, orden respetado).
- [ ] Un pilar sin `status` NO ofrece kanban y cae a `list`/`table` sin romperse.
- [ ] Un pilar con `date` ofrece calendar y timeline.
- [ ] Un `FieldDef` con `type` fuera del catálogo es rechazado en validación (no llega a DB).
- [ ] Exactamente un campo `isTitle` por pilar; cero o dos → error de validación.
- [ ] A lo sumo un campo `status` por pilar → segundo `status` es error de validación.
- [ ] Un pilar generado por la IA que nunca imaginamos (ej. "seguimiento de terapia") se renderiza en al menos `list` + `table` sin intervención manual.

## 5. Fuera de scope de esta spec

- Cómo la IA decide qué campos generar (→ ONBOARDING_GENERATIVE).
- Persistencia (`fields jsonb` ya existe en `pillar_items`; esta spec solo le impone forma).
- Vistas custom individuales (se specifican caso por caso si aparecen).
