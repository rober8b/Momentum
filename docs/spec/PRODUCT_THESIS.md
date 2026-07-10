# Momentum — Product Thesis

> North star. Media página. Todo feature se valida contra esto. Si algo no sirve a esta tesis, no entra.

## En una frase

**Momentum es un dashboard operativo que se genera solo a partir de quién sos.**
No te da pilares; te da *tus* pilares.

## El problema real

Toda app de productividad arranca con una página en blanco. Notion te tira una plantilla genérica que no es tu vida. Obsidian te tira un vault vacío. El costo de arranque es brutal, y ahí muere la mayoría de la retención: la gente nunca cruza el abismo entre "instalé la app" y "tengo un sistema que refleja cómo funciono".

Momentum ataca ese abismo directamente. **Cero página en blanco.**

## La métrica que importa: time-to-structure

No competimos por cantidad de features contra Notion/Obsidian. Competimos por **cuánto tarda alguien en pasar de cero a un sistema operativo que refleja su vida real.**

El "momento ajá" es exacto y medible:
> *"Le dije tres frases sobre mí y ya tenía mi sistema armado, con mis pilares, no los de otro."*

Si el usuario llega a ese momento en < 2 minutos, ganamos. Si no, da igual lo bueno que sea el resto.

## Cómo se llega ahí: onboarding generativo, 3 puertas

Todas desembocan en lo mismo (`materializeOnboarding` → instancia pilares reales en DB):

1. **Brief por texto** — el usuario escribe 2–4 frases de quién es. La IA infiere pilares.
2. **MCP con Claude Code** — el agente ya tiene contexto del usuario y lo rellena.
3. **Conexión a Obsidian** — lee el vault y deduce la estructura que ya existe.

## Qué es y qué no es

- Los 7 pilares originales (Today, Uni, Work, Freelance, Projects, Community, Build) **no son el producto.** Son *un template semilla de ejemplo* — el caso del fundador. Un usuario puede no tener ninguno de ellos.
- El producto **es el motor que convierte "contame quién sos" en estructura viva**, y las vistas que hacen que esa estructura se sienta bien de usar.
- No es una herramienta de notas. Es la **capa operacional diaria** encima de tus notas (Obsidian sigue siendo el sistema de conocimiento; Momentum es el "qué hago hoy").

## Doble naturaleza (decisión asumida)

Se construye **para el fundador y como producto para otros en paralelo.** Consecuencia de diseño: nada puede estar hardcodeado al caso del fundador. Cada vez que aparezca la tentación de asumir "los 7 pilares", es un bug de producto.

## Test de decisión (usar en cada feature)

Antes de construir algo, preguntar:
1. ¿Esto reduce el time-to-structure o mejora el momento ajá? Si no, ¿por qué existe?
2. ¿Asume que el usuario es el fundador? Si sí, está mal.
3. ¿Sobrevive a un pilar que la IA inventó y que nunca imaginamos? Si no, no está terminado.
