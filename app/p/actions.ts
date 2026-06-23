'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PILLAR_TEMPLATES } from '@/lib/pillar-templates';

type PillarRow = typeof schema.pillars.$inferSelect;

async function getOwnedPillar(userId: string, pillarId: string): Promise<PillarRow | null> {
  const [pillar] = await db
    .select()
    .from(schema.pillars)
    .where(and(eq(schema.pillars.id, pillarId), eq(schema.pillars.user_id, userId)))
    .limit(1);
  return pillar ?? null;
}

// Hierarchical pillars (Freelance: client -> task) keep two status
// workflows: the pillar's own (for container items, e.g. clients) and
// config.childView's (for items with a parent, e.g. tasks). See
// docs/DYNAMIC_PILLARS.md locked decision #3 and lib/pillars.ts's
// statusWorkflowFor, which this mirrors for the raw DB row shape used here.
function statusWorkflowFor(pillar: PillarRow, hasParent: boolean) {
  if (hasParent && pillar.config.childView) return pillar.config.childView.status_workflow;
  return pillar.status_workflow;
}

function isValidStatus(pillar: PillarRow, status: string, hasParent: boolean): boolean {
  return statusWorkflowFor(pillar, hasParent).some((s) => s.key === status);
}

// Pillars that have a legacy, pre-dynamic-engine route still live at a fixed
// URL (e.g. /projects, /freelance), gated behind a rollback flag
// (lib/pillar-flags.ts). While that flag is on, that route reads the same
// pillar_items this file writes — so a mutation here must also revalidate
// the legacy path, or it goes stale until the next unrelated navigation.
// Add an entry here whenever a new pillar gets cut over (see
// docs/DYNAMIC_PILLARS.md phase 2+).
const LEGACY_PILLAR_ROUTES: Record<string, string> = {
  projects: '/projects',
  freelance: '/freelance',
};

function revalidatePillarRoutes(key: string, parentItemId?: string | null): void {
  revalidatePath(`/p/${key}`);
  const legacyPath = LEGACY_PILLAR_ROUTES[key];
  if (legacyPath) revalidatePath(legacyPath);
  // A child item's own page is its container's drill-down view, not the
  // pillar's top-level listing — revalidate that too so e.g. moving a task
  // between kanban columns shows up without a hard refresh.
  if (parentItemId) {
    revalidatePath(`/p/${key}/${parentItemId}`);
    if (legacyPath) revalidatePath(`${legacyPath}/${parentItemId}`);
  }
}

export async function instantiateTemplate(templateKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const template = PILLAR_TEMPLATES[templateKey];
  if (!template) return { ok: false, error: 'template desconocido' };

  const [existing] = await db
    .select({ id: schema.pillars.id })
    .from(schema.pillars)
    .where(and(eq(schema.pillars.user_id, user.id), eq(schema.pillars.key, template.key)))
    .limit(1);
  if (existing) return { ok: false, error: 'ya instanciaste este pilar' };

  const userPillars = await db
    .select({ position: schema.pillars.position })
    .from(schema.pillars)
    .where(eq(schema.pillars.user_id, user.id));
  const nextPosition = userPillars.reduce((max, p) => Math.max(max, p.position), -1) + 1;

  const [row] = await db
    .insert(schema.pillars)
    .values({
      user_id: user.id,
      key: template.key,
      name: template.name,
      icon: template.icon,
      description: template.description,
      position: nextPosition,
      view_type: template.view_type,
      status_workflow: template.status_workflow,
      config: template.config,
      source_template: template.key,
    })
    .returning({ id: schema.pillars.id });

  logAudit({ userId: user.id, action: 'create', entityType: 'pillar', entityId: row?.id, metadata: { template: template.key } });
  revalidatePath('/p');
  return { ok: true };
}

const createItemSchema = z.object({
  pillarId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.string().min(1),
  due_date: z.string().optional().nullable(),
  parent_item_id: z.string().uuid().optional().nullable(),
  is_container: z.boolean().default(false),
  fields: z.record(z.string(), z.unknown()).default({}),
});

export async function createPillarItem(input: z.input<typeof createItemSchema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = createItemSchema.parse(input);
  const pillar = await getOwnedPillar(user.id, parsed.pillarId);
  if (!pillar) return { ok: false, error: 'pilar no encontrado' };
  if (!isValidStatus(pillar, parsed.status, Boolean(parsed.parent_item_id))) {
    return { ok: false, error: `estado inválido para este pilar: "${parsed.status}"` };
  }

  if (parsed.parent_item_id) {
    const [parent] = await db
      .select({ id: schema.pillarItems.id, is_container: schema.pillarItems.is_container, pillar_id: schema.pillarItems.pillar_id })
      .from(schema.pillarItems)
      .where(and(eq(schema.pillarItems.id, parsed.parent_item_id), eq(schema.pillarItems.user_id, user.id)))
      .limit(1);
    if (!parent || parent.pillar_id !== pillar.id || !parent.is_container) {
      return { ok: false, error: 'item padre inválido' };
    }
  }

  const [row] = await db
    .insert(schema.pillarItems)
    .values({
      user_id: user.id,
      pillar_id: pillar.id,
      parent_item_id: parsed.parent_item_id ?? null,
      is_container: parsed.is_container,
      title: parsed.title,
      description: parsed.description ?? null,
      status: parsed.status,
      due_date: parsed.due_date ?? null,
      fields: parsed.fields,
    })
    .returning({ id: schema.pillarItems.id });

  logAudit({ userId: user.id, action: 'create', entityType: 'pillar_item', entityId: row?.id, metadata: { pillar: pillar.key } });
  revalidatePillarRoutes(pillar.key, parsed.parent_item_id);
  return { ok: true };
}

export async function updatePillarItemStatus(itemId: string, status: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const [item] = await db
    .select({ id: schema.pillarItems.id, pillar_id: schema.pillarItems.pillar_id, parent_item_id: schema.pillarItems.parent_item_id })
    .from(schema.pillarItems)
    .where(and(eq(schema.pillarItems.id, itemId), eq(schema.pillarItems.user_id, user.id)))
    .limit(1);
  if (!item) return { ok: false, error: 'item no encontrado' };

  const pillar = await getOwnedPillar(user.id, item.pillar_id);
  if (!pillar) return { ok: false, error: 'pilar no encontrado' };
  const hasParent = Boolean(item.parent_item_id);
  if (!isValidStatus(pillar, status, hasParent)) {
    return { ok: false, error: `estado inválido para este pilar: "${status}"` };
  }
  const isTerminal = statusWorkflowFor(pillar, hasParent).find((s) => s.key === status)?.is_terminal ?? false;

  await db
    .update(schema.pillarItems)
    .set({ status, completed_at: isTerminal ? new Date() : null, updated_at: new Date() })
    .where(and(eq(schema.pillarItems.id, itemId), eq(schema.pillarItems.user_id, user.id)));

  logAudit({ userId: user.id, action: 'update', entityType: 'pillar_item', entityId: itemId, metadata: { status } });
  revalidatePillarRoutes(pillar.key, item.parent_item_id);
  return { ok: true };
}

const patchItemSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  fields: z.record(z.string(), z.unknown()).optional(),
});

export async function updatePillarItem(itemId: string, patch: z.input<typeof patchItemSchema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = patchItemSchema.parse(patch);
  const [item] = await db
    .select({ id: schema.pillarItems.id, pillar_id: schema.pillarItems.pillar_id, parent_item_id: schema.pillarItems.parent_item_id })
    .from(schema.pillarItems)
    .where(and(eq(schema.pillarItems.id, itemId), eq(schema.pillarItems.user_id, user.id)))
    .limit(1);
  if (!item) return { ok: false, error: 'item no encontrado' };

  const pillar = await getOwnedPillar(user.id, item.pillar_id);
  if (!pillar) return { ok: false, error: 'pilar no encontrado' };

  await db
    .update(schema.pillarItems)
    .set({ ...parsed, updated_at: new Date() })
    .where(and(eq(schema.pillarItems.id, itemId), eq(schema.pillarItems.user_id, user.id)));

  revalidatePillarRoutes(pillar.key, item.parent_item_id);
  return { ok: true };
}

export async function deletePillarItem(itemId: string): Promise<void> {
  const user = await requireUser();
  const [item] = await db
    .select({ id: schema.pillarItems.id, pillar_id: schema.pillarItems.pillar_id, parent_item_id: schema.pillarItems.parent_item_id })
    .from(schema.pillarItems)
    .where(and(eq(schema.pillarItems.id, itemId), eq(schema.pillarItems.user_id, user.id)))
    .limit(1);
  if (!item) return;

  const pillar = await getOwnedPillar(user.id, item.pillar_id);

  await db.delete(schema.pillarItems).where(and(eq(schema.pillarItems.id, itemId), eq(schema.pillarItems.user_id, user.id)));

  logAudit({ userId: user.id, action: 'delete', entityType: 'pillar_item', entityId: itemId });
  if (pillar) revalidatePillarRoutes(pillar.key, item.parent_item_id);
}
