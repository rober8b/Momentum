/**
 * migrate:build:local — Phase 6a: migrates build_items into the dynamic
 * pillar engine (pillars/pillar_items), per docs/DYNAMIC_PILLARS.md.
 * Build is flat — no hierarchy, every item is_container: false.
 *
 * Run: npm run migrate:build:local
 *
 * - Read-only on build_items — never deletes or modifies the source table.
 * - Idempotent: re-running upserts existing migrated rows (matched by
 *   fields.legacy_source + fields.legacy_id) instead of duplicating them.
 * - Migrates every user that has build_items rows, not just one — this is a
 *   local-only dev script, not the prod cutover.
 * - published_at maps to the typed completed_at column (the "terminal-state
 *   timestamp" convention pillarItemToAssignment/Workblock already use);
 *   everything else without a typed-column fit (hook, draft, type,
 *   platforms, links, metrics, related_project, scheduled_for) goes into
 *   fields.
 */
import postgres from 'postgres';
import { BUILD_TEMPLATE } from '@/lib/pillar-templates';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const sql = postgres(DATABASE_URL, { max: 1 });

// postgres-js's sql.json() wants its own JSONValue type; our jsonb payloads
// are always plain JSON-safe data, so this just sidesteps a structural-
// typing false positive rather than widening anything actually unsafe.
function toJsonb(value: unknown): postgres.Parameter {
  return sql.json(value as Parameters<typeof sql.json>[0]);
}

function isValidBuildStatus(status: string): boolean {
  return BUILD_TEMPLATE.status_workflow.some((s) => s.key === status);
}

type BuildItemRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  draft: string | null;
  hook: string | null;
  platforms: string[];
  status: string;
  scheduled_for: Date | null;
  published_at: Date | null;
  links: Record<string, string>;
  metrics: Record<string, number>;
  related_project: string | null;
  is_sample: boolean;
  created_at: Date;
};

type PillarItemRow = {
  id: string;
  title: string;
  status: string;
  completed_at: Date | null;
  is_sample: boolean;
  fields: Record<string, unknown>;
};

async function ensureBuildPillar(userId: string): Promise<string> {
  const [existing] = (await sql`
    SELECT id FROM pillars WHERE user_id = ${userId} AND key = ${BUILD_TEMPLATE.key}
  `) as Array<{ id: string }>;
  if (existing) return existing.id;

  const [created] = (await sql`
    INSERT INTO pillars (user_id, key, name, icon, description, position, view_type, status_workflow, config, source_template)
    VALUES (
      ${userId}, ${BUILD_TEMPLATE.key}, ${BUILD_TEMPLATE.name}, ${BUILD_TEMPLATE.icon}, ${BUILD_TEMPLATE.description},
      0, ${BUILD_TEMPLATE.view_type}, ${toJsonb(BUILD_TEMPLATE.status_workflow)},
      ${toJsonb(BUILD_TEMPLATE.config)}, ${BUILD_TEMPLATE.key}
    )
    RETURNING id
  `) as Array<{ id: string }>;
  console.log(`  created "build" pillar for user ${userId} -> ${created.id}`);
  return created.id;
}

async function migrateBuildItems(userId: string, pillarId: string, items: BuildItemRow[]) {
  const existingItems = (await sql`
    SELECT id, title, status, completed_at, is_sample, fields
    FROM pillar_items WHERE pillar_id = ${pillarId}
  `) as PillarItemRow[];

  const byLegacyId = new Map<string, string>();
  for (const item of existingItems) {
    if (item.fields?.legacy_source === 'build_items' && typeof item.fields.legacy_id === 'string') {
      byLegacyId.set(item.fields.legacy_id, item.id);
    }
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const b of items) {
    if (!isValidBuildStatus(b.status)) {
      console.warn(`  SKIP build item ${b.id} ("${b.title}"): invalid status "${b.status}"`);
      skipped++;
      continue;
    }

    const fields = {
      type: b.type,
      draft: b.draft,
      hook: b.hook,
      platforms: b.platforms ?? ['x', 'linkedin'],
      links: b.links ?? {},
      metrics: b.metrics ?? {},
      related_project: b.related_project,
      scheduled_for: b.scheduled_for ? b.scheduled_for.toISOString() : null,
      legacy_source: 'build_items',
      legacy_id: b.id,
    };
    const existingItemId = byLegacyId.get(b.id);

    if (existingItemId) {
      await sql`
        UPDATE pillar_items SET
          title = ${b.title},
          status = ${b.status},
          completed_at = ${b.published_at},
          is_sample = ${b.is_sample},
          fields = ${toJsonb(fields)},
          updated_at = now()
        WHERE id = ${existingItemId}
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO pillar_items
          (user_id, pillar_id, is_container, title, status, completed_at, is_sample, fields, created_at, updated_at)
        VALUES (
          ${userId}, ${pillarId}, false, ${b.title}, ${b.status}, ${b.published_at}, ${b.is_sample},
          ${toJsonb(fields)}, ${b.created_at}, now()
        )
      `;
      inserted++;
    }
  }

  return { inserted, updated, skipped };
}

// Re-derives the original build_items shape from the migrated pillar_items
// and diffs against the source rows. Per docs/DYNAMIC_PILLARS.md: "verify
// with round-trip diffs, not row counts."
async function roundTripDiff(userId: string, items: BuildItemRow[]): Promise<string[]> {
  const allItems = (await sql`
    SELECT pi.id, pi.is_container, pi.title, pi.status, pi.completed_at, pi.is_sample, pi.fields
    FROM pillar_items pi
    JOIN pillars p ON p.id = pi.pillar_id
    WHERE p.user_id = ${userId} AND p.key = ${BUILD_TEMPLATE.key}
  `) as Array<PillarItemRow & { is_container: boolean }>;

  const byLegacyId = new Map<string, typeof allItems[number]>();
  for (const item of allItems) {
    if (item.fields?.legacy_source === 'build_items' && typeof item.fields.legacy_id === 'string') {
      byLegacyId.set(item.fields.legacy_id, item);
    }
  }

  const mismatches: string[] = [];

  for (const b of items) {
    const migrated = byLegacyId.get(b.id);
    if (!migrated) {
      if (isValidBuildStatus(b.status)) mismatches.push(`build item ${b.id} ("${b.title}") has no migrated pillar_item`);
      continue;
    }
    const original: Record<string, unknown> = {
      title: b.title,
      status: b.status,
      type: b.type,
      draft: b.draft,
      hook: b.hook,
      platforms: b.platforms ?? ['x', 'linkedin'],
      links: b.links ?? {},
      metrics: b.metrics ?? {},
      related_project: b.related_project,
      scheduled_for: b.scheduled_for ? b.scheduled_for.toISOString() : null,
      published_at: b.published_at ? b.published_at.toISOString() : null,
      is_sample: b.is_sample,
    };
    const rederived: Record<string, unknown> = {
      title: migrated.title,
      status: migrated.status,
      type: migrated.fields.type ?? null,
      draft: migrated.fields.draft ?? null,
      hook: migrated.fields.hook ?? null,
      platforms: migrated.fields.platforms ?? ['x', 'linkedin'],
      links: migrated.fields.links ?? {},
      metrics: migrated.fields.metrics ?? {},
      related_project: migrated.fields.related_project ?? null,
      scheduled_for: migrated.fields.scheduled_for ?? null,
      published_at: migrated.completed_at ? migrated.completed_at.toISOString() : null,
      is_sample: migrated.is_sample,
    };
    const diffFields = Object.keys(original).filter((k) => JSON.stringify(original[k]) !== JSON.stringify(rederived[k]));
    if (migrated.is_container) diffFields.push('is_container (expected false)');
    if (diffFields.length > 0) mismatches.push(`build item ${b.id} ("${b.title}") mismatched: ${diffFields.join(', ')}`);
  }

  return mismatches;
}

async function run() {
  console.log('migrate:build — build_items -> pillars/pillar_items (read-only on source table)\n');

  const allItems = (await sql`SELECT * FROM build_items WHERE user_id IS NOT NULL`) as BuildItemRow[];

  if (allItems.length === 0) {
    console.log('No build_items rows found — nothing to migrate.');
    await sql.end();
    return;
  }

  const itemsByUser = new Map<string, BuildItemRow[]>();
  for (const b of allItems) {
    const list = itemsByUser.get(b.user_id) ?? [];
    list.push(b);
    itemsByUser.set(b.user_id, list);
  }

  let totals = { inserted: 0, updated: 0, skipped: 0 };
  const allMismatches: string[] = [];

  for (const [userId, items] of itemsByUser) {
    console.log(`user ${userId} — ${items.length} build item(s)`);

    const pillarId = await ensureBuildPillar(userId);
    const result = await migrateBuildItems(userId, pillarId, items);
    console.log(`  build items — inserted: ${result.inserted}, updated: ${result.updated}, skipped: ${result.skipped}`);

    totals.inserted += result.inserted;
    totals.updated += result.updated;
    totals.skipped += result.skipped;

    const mismatches = await roundTripDiff(userId, items);
    allMismatches.push(...mismatches);
  }

  console.log('\n--- Summary ---');
  console.log(`users processed: ${itemsByUser.size}`);
  console.log(`build items — inserted: ${totals.inserted}, updated: ${totals.updated}, skipped: ${totals.skipped}`);

  console.log('\n--- Round-trip diff verification ---');
  if (allMismatches.length === 0) {
    console.log('OK — every migrated build item round-trips losslessly through pillar_items.');
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
