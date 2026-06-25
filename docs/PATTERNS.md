# PATTERNS.md — Momentum

Patrones canónicos de código, queries Drizzle, paginación, y tests.

---

## Patrón canónico — server action con auth + validación

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';

const inputSchema = z.object({ title: z.string().min(1) });

export async function createThing(input: z.infer<typeof inputSchema>) {
  const user = await requireUser();           // 1. auth — devuelve user completo
  const parsed = inputSchema.parse(input);    // 2. validate
  await db.insert(schema.x).values({ ...parsed, user_id: user.id }); // 3. scope al user
  revalidatePath('/');                        // 4. revalidate Today
  revalidatePath('/x');                       // 5. revalidate listado del pilar
}
```

---

## Patrón canónico — server component que lee data

```tsx
// app/work/page.tsx
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rowToWorkblock } from '@/lib/today';

export const dynamic = 'force-dynamic';

export default async function WorkPage() {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(schema.workblocks)
    .where(eq(schema.workblocks.user_id, user.id))   // siempre filtrar por user_id
    .orderBy(desc(schema.workblocks.created_at));
  const workblocks = rows.map(rowToWorkblock);
  return <KanbanBoard workblocks={workblocks} lang={user.settings.language} />;
}
```

---

## Patrón canónico — client component con server action

```tsx
'use client';
import { useState, useTransition } from 'react';
import { updateWorkblockStatus } from '@/app/work/actions';

export function Card({ workblock }) {
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState(workblock.status);

  function advance(next: WorkblockStatus) {
    startTransition(async () => {
      setStatus(next);                                  // optimistic
      await updateWorkblockStatus(workblock.id, next);  // server
    });
  }
  // ...
}
```

---

## Drizzle — queries útiles

```ts
import { eq, and, or, ne, gte, lte, inArray, asc, desc, sql } from 'drizzle-orm';

// Igualdad
await db.select().from(schema.x).where(eq(schema.x.status, 'done'));

// AND compuesto
await db.select().from(schema.x).where(
  and(eq(schema.x.status, 'done'), gte(schema.x.created_at, since))
);

// IN
await db.select().from(schema.x).where(inArray(schema.x.status, ['todo', 'in-progress']));

// Order custom (case/when para enums sin orden natural)
const PRIORITY_ORDER = sql`case ${schema.workblocks.priority}
  when 'high' then 0 when 'med' then 1 when 'low' then 2 else 3 end`;
await db.select().from(schema.workblocks).orderBy(PRIORITY_ORDER, asc(schema.workblocks.position));

// Limit + single result
const [row] = await db.select().from(schema.x).where(eq(schema.x.id, id)).limit(1);
if (!row) notFound();

// Count
const [{ count }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(schema.x)
  .where(eq(schema.x.user_id, user.id));
```

---

## Paginación

**Lo activo queda sin límite, lo histórico (`done`/`archived`/`cancelled`) se pagina a nivel SQL.**

Las listas kanban muestran datos activos — ese set es chico por naturaleza (tu carga de trabajo actual). Lo que crece sin límite con el tiempo es lo *completado* — eso es lo que se pagina.

**Nunca** uses `.slice(0, N)` en JS después de un fetch sin límite — eso trae la tabla entera a Node antes de cortarla.

Componente reutilizable: `components/ui/Pagination.tsx`. Acepta `paramName` para soportar más de una sección paginada en la misma page (ej. `build/page.tsx` pagina `published` y `discarded` con `pubPage` y `discPage` por separado).

```ts
// Patrón canónico — ver app/work/page.tsx o app/projects/page.tsx
const PAGE_SIZE = 24;
const { donePage: pageParam } = await searchParams; // searchParams es Promise en Next 16
const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);

const [activeRows, doneRows, [{ count: doneCount }]] = await Promise.all([
  db.select().from(schema.x)
    .where(and(eq(schema.x.user_id, user.id), ne(schema.x.status, 'done'))),  // sin límite
  db.select().from(schema.x)
    .where(and(eq(schema.x.user_id, user.id), eq(schema.x.status, 'done')))
    .orderBy(desc(schema.x.created_at))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE),
  db.select({ count: sql<number>`count(*)::int` }).from(schema.x)
    .where(and(eq(schema.x.user_id, user.id), eq(schema.x.status, 'done'))),
]);

const doneTotalPages = Math.max(1, Math.ceil(doneCount / PAGE_SIZE));
// <Pagination basePath="/work" page={page} totalPages={doneTotalPages} paramName="donePage" />
```

Si el bucket "activo" también puede crecer sin límite con el tiempo (no es obviamente acotado por naturaleza), pensarlo dos veces antes de asumir que no necesita paginación.

---

## Tests

**Vitest** — tests junto al código (`*.test.ts`), sin carpeta `__tests__/` separada.

```bash
npm test            # suite completa (vitest run)
npm run test:watch  # watch mode
```

**Filosofía:** no hay cobertura exhaustiva. Los tests cubren flujos donde un bug es caro: **dinero** (billing) y **acceso** (auth/admin). Si agregás un flujo de ese tipo, agregale tests. CRUD de un pilar más: no.

### Cobertura actual

| Archivo | Qué testea |
|---------|-----------|
| `lib/auth.test.ts` | HMAC sign/verify de la cookie de sesión (roundtrip, tamper, secret distinto), `requireUser` (usuario inactivo, sesión invalidada por `invalidate_sessions_before`), `requireAdmin` (rechaza member) |
| `lib/limits.test.ts` | `checkLimit` — self-host siempre unlimited sin tocar la DB; hosted con plan free bajo/al/sobre el límite; plan pro unlimited |
| `lib/polar-webhook.test.ts` | `resolvePolarEvent` — mapeo evento→plan completo (todas las transiciones de `subscription.updated`, `revoked`→free, `order.paid`→pro, eventos no manejados→null) |
| `app/admin/actions.test.ts` | Guard de auto-lockout en `setUserActive`/`setUserRole` — un admin no puede desactivarse ni quitarse el rol a sí mismo |

### Cómo mockear la DB (sin Postgres real)

`test/stubs/db-mock.ts` — reemplazo de `@/lib/db` con un mock encadenable+then-able. Cada llamada a `db.select()/insert()/update()/delete()` resuelve al próximo resultado encolado con `queueResult([...])`, en el mismo orden en que el código los dispara.

```ts
vi.mock('@/lib/db', () => import('../test/stubs/db-mock'));
import { queueResult, resetDbMock } from '../test/stubs/db-mock';

beforeEach(() => resetDbMock());

// En el test:
queueResult([{ id: '1', active: true }]); // resultado de la próxima query
```

### Quirks de Vitest en este proyecto

- `'server-only'` está aliaseado a un stub vacío en `vitest.config.ts` — sin el alias, cualquier `lib/*.ts` con `import 'server-only'` rompe al importarse en un test.
- Variables referenciadas dentro de un factory de `vi.mock(...)` que no sean otro `import(...)` dinámico deben pasar por `vi.hoisted(() => ({...}))` — `vi.mock` se hoistea por encima de todo, así que un `const` declarado más abajo todavía no existe cuando el factory corre.

---

## Patrón — pilares dinámicos (motor)

Para CRUD de pilares dinámicos ver `app/p/actions.ts` (genérico) y `lib/pillar-writes.ts` (escrituras compartidas: import, sample data). Los flags de rollback están en `lib/pillar-flags.ts`.

Cada ruta de pilar bifurca:
```ts
import { isBuildDynamic } from '@/lib/pillar-flags';

if (isBuildDynamic()) {
  // leer de pillar_items
} else {
  // código legacy byte-por-byte intacto
}
```

Después de mutaciones en pilares dinámicos, usar `revalidatePillarRoutes(pillarKey)` de `app/p/actions.ts` en lugar de `revalidatePath` manual.
