// Phase 5b — shared write helpers for the dynamic pillar engine, used by the
// API v1 import routes and the sample-data action. Deliberately NOT in
// lib/pillars.ts: that file is imported by components/pillars/GenericList.tsx
// ('use client'), so a db import there would leak server-only code into the
// client bundle. See docs/DYNAMIC_PILLARS.md.
//
// Unlike app/p/actions.ts's createPillarItem (cookie-session-authed, single
// item, no is_sample support), these take a userId directly — the import
// routes are Bearer-token-authed (no session cookie) and sample data needs
// is_sample:true, which createPillarItem's schema doesn't expose.
import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { PillarTemplate } from '@/lib/pillar-templates';

// Find-or-create the user's `pillars` row for this template — same shape
// migrate-*.ts's ensureXPillar() helpers already use for the one-time
// migration scripts.
export async function ensurePillarForUser(userId: string, template: PillarTemplate): Promise<string> {
  const [existing] = await db
    .select({ id: schema.pillars.id })
    .from(schema.pillars)
    .where(and(eq(schema.pillars.user_id, userId), eq(schema.pillars.key, template.key)))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(schema.pillars)
    .values({
      user_id: userId,
      key: template.key,
      name: template.name,
      icon: template.icon,
      description: template.description,
      position: 0,
      view_type: template.view_type,
      status_workflow: template.status_workflow,
      config: template.config,
      source_template: template.key,
    })
    .returning({ id: schema.pillars.id });
  return created!.id;
}

// Exact-title match within a pillar (+ optional extra jsonb fields->>key
// match — Uni's subject dedup key is name+semester, not name alone).
// Mirrors each legacy import route's own find-or-create exactly: Community
// dedupes organizations by name only; Uni dedupes subjects by name+semester.
export async function findOrCreateContainerItem(
  userId: string,
  pillarId: string,
  title: string,
  opts: { status: string; fields?: Record<string, unknown>; matchFields?: Record<string, string>; isSample?: boolean },
): Promise<string> {
  const matchConditions = [
    eq(schema.pillarItems.user_id, userId),
    eq(schema.pillarItems.pillar_id, pillarId),
    eq(schema.pillarItems.is_container, true),
    eq(schema.pillarItems.title, title),
  ];
  for (const [key, value] of Object.entries(opts.matchFields ?? {})) {
    matchConditions.push(sql`${schema.pillarItems.fields}->>${key} = ${value}`);
  }

  const [existing] = await db
    .select({ id: schema.pillarItems.id })
    .from(schema.pillarItems)
    .where(and(...matchConditions))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(schema.pillarItems)
    .values({
      user_id: userId,
      pillar_id: pillarId,
      is_container: true,
      title,
      status: opts.status,
      fields: opts.fields ?? {},
      is_sample: opts.isSample ?? false,
    })
    .returning({ id: schema.pillarItems.id });
  return created!.id;
}

// Subset of the db/tx query-builder surface this module needs — lets
// callers pass a transaction handle (e.g. Freelance import's client+tasks
// transaction) instead of the plain `db` singleton, so a mid-batch failure
// rolls back cleanly, same as the legacy transactional import did.
type DbExecutor = Pick<typeof db, 'insert' | 'select'>;

// Plain insert, no dedup — used wherever the legacy behavior never deduped
// either (Freelance import never dedupes clients by name; sample data never
// dedupes anything).
export async function insertPillarItem(
  params: {
    userId: string;
    pillarId: string;
    parentItemId?: string | null;
    isContainer: boolean;
    title: string;
    description?: string | null;
    status: string;
    dueDate?: string | null;
    completedAt?: Date | null;
    position?: number;
    fields?: Record<string, unknown>;
    isSample?: boolean;
  },
  executor: DbExecutor = db,
): Promise<string> {
  const [row] = await executor
    .insert(schema.pillarItems)
    .values({
      user_id: params.userId,
      pillar_id: params.pillarId,
      parent_item_id: params.parentItemId ?? null,
      is_container: params.isContainer,
      title: params.title,
      description: params.description ?? null,
      status: params.status,
      due_date: params.dueDate ?? null,
      completed_at: params.completedAt ?? null,
      position: params.position ?? 0,
      fields: params.fields ?? {},
      is_sample: params.isSample ?? false,
    })
    .returning({ id: schema.pillarItems.id });
  return row!.id;
}
