/**
 * migrate:work:local — Phase 6c: migrates workblocks into the dynamic
 * pillar engine (pillars/pillar_items), per docs/DYNAMIC_PILLARS.md.
 * Work is flat — no hierarchy, every item is_container: false.
 *
 * Run: npm run migrate:work:local
 *
 * - Read-only on workblocks — never deletes or modifies the source table.
 * - Idempotent: re-running upserts existing migrated rows (matched by
 *   fields.legacy_source + fields.legacy_id) instead of duplicating them.
 * - Migrates every user that has workblocks rows, not just one — this is a
 *   local-only dev script, not the prod cutover.
 * - position is preserved exactly (manual kanban ordering within a status
 *   column); type/priority/client/notes/links have no typed-column fit and
 *   go into fields.
 */
import postgres from 'postgres';
import { WORK_TEMPLATE } from '@/lib/pillar-templates';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const sql = postgres(DATABASE_URL, { max: 1 });

// postgres-js's sql.json() wants its own JSONValue type; our jsonb payloads
// are always plain JSON-safe data, so this just sidesteps a structural-
// typing false positive rather than widening anything actually unsafe.
function toJsonb(value: unknown): postgres.Parameter {
  return sql.json(value as Parameters<typeof sql.json>[0]);
}

function isValidWorkStatus(status: string): boolean {
  return WORK_TEMPLATE.status_workflow.some((s) => s.key === status);
}

type WorkblockRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  client: string;
  notes: string | null;
  links: Record<string, string>;
  position: number;
  is_sample: boolean;
  created_at: Date;
  completed_at: Date | null;
};

type PillarItemRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  completed_at: Date | null;
  position: number;
  is_sample: boolean;
  fields: Record<string, unknown>;
};

async function ensureWorkPillar(userId: string): Promise<string> {
  const [existing] = (await sql`
    SELECT id FROM pillars WHERE user_id = ${userId} AND key = ${WORK_TEMPLATE.key}
  `) as Array<{ id: string }>;
  if (existing) return existing.id;

  const [created] = (await sql`
    INSERT INTO pillars (user_id, key, name, icon, description, position, view_type, status_workflow, config, source_template)
    VALUES (
      ${userId}, ${WORK_TEMPLATE.key}, ${WORK_TEMPLATE.name}, ${WORK_TEMPLATE.icon}, ${WORK_TEMPLATE.description},
      0, ${WORK_TEMPLATE.view_type}, ${toJsonb(WORK_TEMPLATE.status_workflow)},
      ${toJsonb(WORK_TEMPLATE.config)}, ${WORK_TEMPLATE.key}
    )
    RETURNING id
  `) as Array<{ id: string }>;
  console.log(`  created "work" pillar for user ${userId} -> ${created.id}`);
  return created.id;
}

async function migrateWorkblocks(userId: string, pillarId: string, items: WorkblockRow[]) {
  const existingItems = (await sql`
    SELECT id, title, description, status, due_date, completed_at, position, is_sample, fields
    FROM pillar_items WHERE pillar_id = ${pillarId}
  `) as PillarItemRow[];

  const byLegacyId = new Map<string, string>();
  for (const item of existingItems) {
    if (item.fields?.legacy_source === 'workblocks' && typeof item.fields.legacy_id === 'string') {
      byLegacyId.set(item.fields.legacy_id, item.id);
    }
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const w of items) {
    if (!isValidWorkStatus(w.status)) {
      console.warn(`  SKIP workblock ${w.id} ("${w.title}"): invalid status "${w.status}"`);
      skipped++;
      continue;
    }

    const fields = {
      type: w.type,
      priority: w.priority,
      client: w.client ?? '',
      notes: w.notes,
      links: w.links ?? {},
      legacy_source: 'workblocks',
      legacy_id: w.id,
    };
    const existingItemId = byLegacyId.get(w.id);

    if (existingItemId) {
      await sql`
        UPDATE pillar_items SET
          title = ${w.title},
          description = ${w.description},
          status = ${w.status},
          due_date = ${w.due_date},
          completed_at = ${w.completed_at},
          position = ${w.position},
          is_sample = ${w.is_sample},
          fields = ${toJsonb(fields)},
          updated_at = now()
        WHERE id = ${existingItemId}
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO pillar_items
          (user_id, pillar_id, is_container, title, description, status, due_date, completed_at, position, is_sample, fields, created_at, updated_at)
        VALUES (
          ${userId}, ${pillarId}, false, ${w.title}, ${w.description}, ${w.status}, ${w.due_date}, ${w.completed_at},
          ${w.position}, ${w.is_sample}, ${toJsonb(fields)}, ${w.created_at}, now()
        )
      `;
      inserted++;
    }
  }

  return { inserted, updated, skipped };
}

// Re-derives the original workblocks shape from the migrated pillar_items
// and diffs against the source rows. Per docs/DYNAMIC_PILLARS.md: "verify
// with round-trip diffs, not row counts." Pays particular attention to
// position (manual kanban ordering) since that's the new field this
// cutover introduces that Build/Projects didn't meaningfully exercise.
async function roundTripDiff(userId: string, items: WorkblockRow[]): Promise<string[]> {
  const allItems = (await sql`
    SELECT pi.id, pi.is_container, pi.title, pi.description, pi.status, pi.due_date, pi.completed_at, pi.position, pi.is_sample, pi.fields
    FROM pillar_items pi
    JOIN pillars p ON p.id = pi.pillar_id
    WHERE p.user_id = ${userId} AND p.key = ${WORK_TEMPLATE.key}
  `) as Array<PillarItemRow & { is_container: boolean }>;

  const byLegacyId = new Map<string, typeof allItems[number]>();
  for (const item of allItems) {
    if (item.fields?.legacy_source === 'workblocks' && typeof item.fields.legacy_id === 'string') {
      byLegacyId.set(item.fields.legacy_id, item);
    }
  }

  const mismatches: string[] = [];

  for (const w of items) {
    const migrated = byLegacyId.get(w.id);
    if (!migrated) {
      if (isValidWorkStatus(w.status)) mismatches.push(`workblock ${w.id} ("${w.title}") has no migrated pillar_item`);
      continue;
    }
    const original: Record<string, unknown> = {
      title: w.title,
      description: w.description,
      status: w.status,
      due_date: w.due_date,
      completed_at: w.completed_at ? w.completed_at.toISOString() : null,
      position: w.position,
      type: w.type,
      priority: w.priority,
      client: w.client ?? '',
      notes: w.notes,
      links: w.links ?? {},
      is_sample: w.is_sample,
    };
    const rederived: Record<string, unknown> = {
      title: migrated.title,
      description: migrated.description,
      status: migrated.status,
      due_date: migrated.due_date,
      completed_at: migrated.completed_at ? migrated.completed_at.toISOString() : null,
      position: migrated.position,
      type: migrated.fields.type ?? null,
      priority: migrated.fields.priority ?? null,
      client: migrated.fields.client ?? '',
      notes: migrated.fields.notes ?? null,
      links: migrated.fields.links ?? {},
      is_sample: migrated.is_sample,
    };
    const diffFields = Object.keys(original).filter((k) => JSON.stringify(original[k]) !== JSON.stringify(rederived[k]));
    if (migrated.is_container) diffFields.push('is_container (expected false)');
    if (diffFields.length > 0) mismatches.push(`workblock ${w.id} ("${w.title}") mismatched: ${diffFields.join(', ')}`);
  }

  return mismatches;
}

async function run() {
  console.log('migrate:work — workblocks -> pillars/pillar_items (read-only on source table)\n');

  const allItems = (await sql`SELECT * FROM workblocks WHERE user_id IS NOT NULL`) as WorkblockRow[];

  if (allItems.length === 0) {
    console.log('No workblocks rows found — nothing to migrate.');
    await sql.end();
    return;
  }

  const itemsByUser = new Map<string, WorkblockRow[]>();
  for (const w of allItems) {
    const list = itemsByUser.get(w.user_id) ?? [];
    list.push(w);
    itemsByUser.set(w.user_id, list);
  }

  let totals = { inserted: 0, updated: 0, skipped: 0 };
  const allMismatches: string[] = [];

  for (const [userId, items] of itemsByUser) {
    console.log(`user ${userId} — ${items.length} workblock(s)`);

    const pillarId = await ensureWorkPillar(userId);
    const result = await migrateWorkblocks(userId, pillarId, items);
    console.log(`  workblocks — inserted: ${result.inserted}, updated: ${result.updated}, skipped: ${result.skipped}`);

    totals.inserted += result.inserted;
    totals.updated += result.updated;
    totals.skipped += result.skipped;

    const mismatches = await roundTripDiff(userId, items);
    allMismatches.push(...mismatches);
  }

  console.log('\n--- Summary ---');
  console.log(`users processed: ${itemsByUser.size}`);
  console.log(`workblocks — inserted: ${totals.inserted}, updated: ${totals.updated}, skipped: ${totals.skipped}`);

  console.log('\n--- Round-trip diff verification ---');
  if (allMismatches.length === 0) {
    console.log('OK — every migrated workblock round-trips losslessly through pillar_items.');
  } else {
    console.log(`${allMismatches.length} mismatch(es) found:`);
    for (const m of allMismatches) console.log(`  - ${m}`);
  }

  await sql.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
