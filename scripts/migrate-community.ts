/**
 * migrate:community:local — Sprint B Phase 4 (pillar 1 of 2): migrates
 * organizations + community_items into the dynamic pillar engine
 * (pillars/pillar_items), per docs/DYNAMIC_PILLARS.md. This is the first
 * OPTIONAL-grouping migration: organizations become containers, community
 * items become children — but unlike Freelance, a community item may have
 * NO organization (organization_id was nullable on the legacy table). Those
 * items migrate as first-class items with parent_item_id = NULL, not as an
 * error or excluded case.
 *
 * Run: npm run migrate:community:local
 *
 * - Read-only on organizations/community_items — never deletes or modifies
 *   the source tables.
 * - Idempotent: re-running upserts existing migrated rows (matched by
 *   fields.legacy_source + fields.legacy_id) instead of duplicating them.
 * - Migrates every user that has organizations OR community_items rows, not
 *   just one — this is a local-only dev script, not the prod cutover.
 * - Organizations are migrated before community_items (an item's
 *   parent_item_id needs the organization's NEW pillar_item id, which only
 *   exists after the organization row is migrated).
 */
import postgres from 'postgres';
import { COMMUNITY_TEMPLATE } from '@/lib/pillar-templates';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const sql = postgres(DATABASE_URL, { max: 1 });

// postgres-js's sql.json() wants its own JSONValue type; our jsonb payloads
// are always plain JSON-safe data, so this just sidesteps a structural-
// typing false positive rather than widening anything actually unsafe.
function toJsonb(value: unknown): postgres.Parameter {
  return sql.json(value as Parameters<typeof sql.json>[0]);
}

const childView = COMMUNITY_TEMPLATE.config.childView;
if (!childView) throw new Error('COMMUNITY_TEMPLATE.config.childView is required for this migration');

const CONTAINER_STATUS = COMMUNITY_TEMPLATE.status_workflow[0]?.key;
if (!CONTAINER_STATUS) throw new Error('COMMUNITY_TEMPLATE.status_workflow must have at least one state');

type OrgRow = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  is_sample: boolean;
  created_at: Date;
};

type CommunityItemRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  is_sample: boolean;
  created_at: Date;
};

type PillarItemRow = {
  id: string;
  parent_item_id: string | null;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  is_sample: boolean;
  fields: Record<string, unknown>;
};

function isValidItemStatus(status: string): boolean {
  return childView!.status_workflow.some((s) => s.key === status);
}

async function ensureCommunityPillar(userId: string): Promise<string> {
  const [existing] = (await sql`
    SELECT id FROM pillars WHERE user_id = ${userId} AND key = ${COMMUNITY_TEMPLATE.key}
  `) as Array<{ id: string }>;
  if (existing) return existing.id;

  const [created] = (await sql`
    INSERT INTO pillars (user_id, key, name, icon, description, position, view_type, status_workflow, config, source_template)
    VALUES (
      ${userId}, ${COMMUNITY_TEMPLATE.key}, ${COMMUNITY_TEMPLATE.name}, ${COMMUNITY_TEMPLATE.icon}, ${COMMUNITY_TEMPLATE.description},
      0, ${COMMUNITY_TEMPLATE.view_type}, ${toJsonb(COMMUNITY_TEMPLATE.status_workflow)},
      ${toJsonb(COMMUNITY_TEMPLATE.config)}, ${COMMUNITY_TEMPLATE.key}
    )
    RETURNING id
  `) as Array<{ id: string }>;
  console.log(`  created "community" pillar for user ${userId} -> ${created.id}`);
  return created.id;
}

// Returns a map of organizations.id -> new pillar_items.id for every org
// successfully migrated (existing or freshly inserted), so the item
// migration pass below can resolve parent_item_id.
async function migrateOrgs(userId: string, pillarId: string, orgs: OrgRow[]) {
  const existingItems = (await sql`
    SELECT id, title, description, status, due_date, is_sample, fields
    FROM pillar_items WHERE pillar_id = ${pillarId} AND is_container = true
  `) as PillarItemRow[];

  const byLegacyId = new Map<string, string>();
  for (const item of existingItems) {
    if (item.fields?.legacy_source === 'organizations' && typeof item.fields.legacy_id === 'string') {
      byLegacyId.set(item.fields.legacy_id, item.id);
    }
  }

  let inserted = 0;
  let updated = 0;
  const orgIdMap = new Map<string, string>();

  for (const o of orgs) {
    const fields = {
      slug: o.slug,
      legacy_source: 'organizations',
      legacy_id: o.id,
    };
    const existingItemId = byLegacyId.get(o.id);

    if (existingItemId) {
      await sql`
        UPDATE pillar_items SET
          title = ${o.name},
          status = ${CONTAINER_STATUS},
          is_sample = ${o.is_sample},
          fields = ${toJsonb(fields)},
          updated_at = now()
        WHERE id = ${existingItemId}
      `;
      updated++;
      orgIdMap.set(o.id, existingItemId);
    } else {
      const [row] = (await sql`
        INSERT INTO pillar_items
          (user_id, pillar_id, is_container, title, status, is_sample, fields, created_at, updated_at)
        VALUES (
          ${userId}, ${pillarId}, true, ${o.name}, ${CONTAINER_STATUS}, ${o.is_sample},
          ${toJsonb(fields)}, ${o.created_at}, now()
        )
        RETURNING id
      `) as Array<{ id: string }>;
      inserted++;
      orgIdMap.set(o.id, row.id);
    }
  }

  return { inserted, updated, orgIdMap };
}

async function migrateItems(userId: string, pillarId: string, items: CommunityItemRow[], orgIdMap: Map<string, string>) {
  const existingItems = (await sql`
    SELECT id, title, description, status, due_date, is_sample, fields
    FROM pillar_items WHERE pillar_id = ${pillarId} AND is_container = false
  `) as PillarItemRow[];

  const byLegacyId = new Map<string, string>();
  for (const item of existingItems) {
    if (item.fields?.legacy_source === 'community_items' && typeof item.fields.legacy_id === 'string') {
      byLegacyId.set(item.fields.legacy_id, item.id);
    }
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const c of items) {
    if (!isValidItemStatus(c.status)) {
      console.warn(`  SKIP community_item ${c.id} ("${c.title}"): invalid status "${c.status}"`);
      skipped++;
      continue;
    }
    // The defining case for this pillar: organization_id is OPTIONAL. When
    // it's null, parent_item_id stays NULL — the item migrates as a
    // first-class ungrouped item, not an error or excluded row.
    const parentItemId = c.organization_id ? orgIdMap.get(c.organization_id) ?? null : null;
    if (c.organization_id && !parentItemId) {
      console.warn(`  SKIP community_item ${c.id} ("${c.title}"): no migrated org for organization_id ${c.organization_id}`);
      skipped++;
      continue;
    }

    const fields = {
      legacy_source: 'community_items',
      legacy_id: c.id,
    };
    const existingItemId = byLegacyId.get(c.id);

    if (existingItemId) {
      await sql`
        UPDATE pillar_items SET
          parent_item_id = ${parentItemId},
          title = ${c.title},
          description = ${c.description},
          status = ${c.status},
          due_date = ${c.due_date},
          is_sample = ${c.is_sample},
          fields = ${toJsonb(fields)},
          updated_at = now()
        WHERE id = ${existingItemId}
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO pillar_items
          (user_id, pillar_id, parent_item_id, is_container, title, description, status, due_date, is_sample, fields, created_at, updated_at)
        VALUES (
          ${userId}, ${pillarId}, ${parentItemId}, false, ${c.title}, ${c.description}, ${c.status}, ${c.due_date}, ${c.is_sample},
          ${toJsonb(fields)}, ${c.created_at}, now()
        )
      `;
      inserted++;
    }
  }

  return { inserted, updated, skipped };
}

// Re-derives the original shape of both source tables from the migrated
// pillar_items and diffs against the source rows. Per docs/DYNAMIC_PILLARS.md:
// "verify with round-trip diffs, not row counts."
async function roundTripDiff(userId: string, orgs: OrgRow[], items: CommunityItemRow[]): Promise<string[]> {
  const allItems = (await sql`
    SELECT pi.id, pi.parent_item_id, pi.is_container, pi.title, pi.description, pi.status, pi.due_date, pi.is_sample, pi.fields
    FROM pillar_items pi
    JOIN pillars p ON p.id = pi.pillar_id
    WHERE p.user_id = ${userId} AND p.key = ${COMMUNITY_TEMPLATE.key}
  `) as Array<PillarItemRow & { is_container: boolean }>;

  const orgItemByLegacyId = new Map<string, typeof allItems[number]>();
  const itemByLegacyId = new Map<string, typeof allItems[number]>();
  for (const item of allItems) {
    if (item.fields?.legacy_source === 'organizations' && typeof item.fields.legacy_id === 'string') {
      orgItemByLegacyId.set(item.fields.legacy_id, item);
    }
    if (item.fields?.legacy_source === 'community_items' && typeof item.fields.legacy_id === 'string') {
      itemByLegacyId.set(item.fields.legacy_id, item);
    }
  }

  const mismatches: string[] = [];

  for (const o of orgs) {
    const migrated = orgItemByLegacyId.get(o.id);
    if (!migrated) {
      mismatches.push(`organization ${o.id} ("${o.name}") has no migrated pillar_item`);
      continue;
    }
    const original: Record<string, unknown> = { name: o.name, slug: o.slug, is_sample: o.is_sample };
    const rederived: Record<string, unknown> = { name: migrated.title, slug: migrated.fields.slug ?? null, is_sample: migrated.is_sample };
    const diffFields = Object.keys(original).filter((k) => JSON.stringify(original[k]) !== JSON.stringify(rederived[k]));
    if (!migrated.is_container) diffFields.push('is_container (expected true)');
    if (diffFields.length > 0) mismatches.push(`organization ${o.id} ("${o.name}") mismatched: ${diffFields.join(', ')}`);
  }

  for (const c of items) {
    const migrated = itemByLegacyId.get(c.id);
    if (!migrated) {
      if (isValidItemStatus(c.status)) mismatches.push(`community_item ${c.id} ("${c.title}") has no migrated pillar_item`);
      continue;
    }
    // The round-trip-critical case: an item with NO organization must come
    // back with parent_item_id NULL, not silently attached to something.
    const expectedParentItem = c.organization_id ? orgItemByLegacyId.get(c.organization_id) : undefined;
    const original: Record<string, unknown> = {
      title: c.title, description: c.description, status: c.status, due_date: c.due_date, is_sample: c.is_sample,
      parent_item_id: expectedParentItem?.id ?? null,
    };
    const rederived: Record<string, unknown> = {
      title: migrated.title, description: migrated.description, status: migrated.status, due_date: migrated.due_date, is_sample: migrated.is_sample,
      parent_item_id: migrated.parent_item_id,
    };
    const diffFields = Object.keys(original).filter((k) => JSON.stringify(original[k]) !== JSON.stringify(rederived[k]));
    if (migrated.is_container) diffFields.push('is_container (expected false)');
    if (diffFields.length > 0) mismatches.push(`community_item ${c.id} ("${c.title}") mismatched: ${diffFields.join(', ')}`);
  }

  return mismatches;
}

async function run() {
  console.log('migrate:community — organizations/community_items -> pillars/pillar_items (read-only on source tables)\n');

  const allOrgs = (await sql`SELECT * FROM organizations WHERE user_id IS NOT NULL`) as OrgRow[];
  const allItems = (await sql`SELECT * FROM community_items WHERE user_id IS NOT NULL`) as CommunityItemRow[];

  if (allOrgs.length === 0 && allItems.length === 0) {
    console.log('No organizations or community_items rows found — nothing to migrate.');
    await sql.end();
    return;
  }

  const orgsByUser = new Map<string, OrgRow[]>();
  for (const o of allOrgs) {
    const list = orgsByUser.get(o.user_id) ?? [];
    list.push(o);
    orgsByUser.set(o.user_id, list);
  }
  const itemsByUser = new Map<string, CommunityItemRow[]>();
  for (const c of allItems) {
    const list = itemsByUser.get(c.user_id) ?? [];
    list.push(c);
    itemsByUser.set(c.user_id, list);
  }

  const allUserIds = new Set([...orgsByUser.keys(), ...itemsByUser.keys()]);
  let totals = { orgsInserted: 0, orgsUpdated: 0, itemsInserted: 0, itemsUpdated: 0, itemsSkipped: 0 };
  const allMismatches: string[] = [];

  for (const userId of allUserIds) {
    const orgs = orgsByUser.get(userId) ?? [];
    const items = itemsByUser.get(userId) ?? [];
    console.log(`user ${userId} — ${orgs.length} org(s), ${items.length} item(s)`);

    const pillarId = await ensureCommunityPillar(userId);
    const orgResult = await migrateOrgs(userId, pillarId, orgs);
    console.log(`  orgs  — inserted: ${orgResult.inserted}, updated: ${orgResult.updated}`);

    const itemResult = await migrateItems(userId, pillarId, items, orgResult.orgIdMap);
    console.log(`  items — inserted: ${itemResult.inserted}, updated: ${itemResult.updated}, skipped: ${itemResult.skipped}`);

    totals.orgsInserted += orgResult.inserted;
    totals.orgsUpdated += orgResult.updated;
    totals.itemsInserted += itemResult.inserted;
    totals.itemsUpdated += itemResult.updated;
    totals.itemsSkipped += itemResult.skipped;

    const mismatches = await roundTripDiff(userId, orgs, items);
    allMismatches.push(...mismatches);
  }

  console.log('\n--- Summary ---');
  console.log(`users processed: ${allUserIds.size}`);
  console.log(`orgs  — inserted: ${totals.orgsInserted}, updated: ${totals.orgsUpdated}`);
  console.log(`items — inserted: ${totals.itemsInserted}, updated: ${totals.itemsUpdated}, skipped: ${totals.itemsSkipped}`);

  console.log('\n--- Round-trip diff verification ---');
  if (allMismatches.length === 0) {
    console.log('OK — every migrated organization and community item round-trips losslessly through pillar_items.');
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
