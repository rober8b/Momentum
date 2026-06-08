/**
 * Migration: convert community_items.organization (text enum) to organization_id FK.
 *
 * Run once after deploying the schema change:
 *   node --env-file=.env.local --input-type=module < scripts/migrate-community-orgs.ts
 *
 * What this does:
 * 1. For each user that has community_items, reads all distinct old org values from
 *    a temporary column (if it still exists) and creates Organization rows.
 * 2. Updates community_items.organization_id to point to the new rows.
 *
 * NOTE: This script handles the transition from the old `organization` column
 * (ai-consensus | levellers | xplora | other) to the new `organization_id` FK.
 * After running this script and verifying data, you can drop the old column with:
 *   ALTER TABLE community_items DROP COLUMN IF EXISTS organization;
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const sql = postgres(DATABASE_URL, { max: 1 });

// Legacy org display names (from the old hardcoded enum)
const LEGACY_ORG_NAMES: Record<string, string> = {
  'ai-consensus': 'AI Consensus',
  'levellers': 'The Levellers',
  'xplora': 'Xplora',
  'other': 'Other',
};

async function run() {
  console.log('Starting community orgs migration…');

  // Check if old column still exists
  const [colCheck] = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'community_items' AND column_name = 'organization'
  `;

  if (!colCheck) {
    console.log('Old "organization" column not found — migration already done or not needed.');
    await sql.end();
    return;
  }

  // Get all users with community items that have the old org value set
  const rows = await sql`
    SELECT DISTINCT user_id, organization
    FROM community_items
    WHERE organization IS NOT NULL AND organization != ''
  ` as Array<{ user_id: string; organization: string }>;

  if (rows.length === 0) {
    console.log('No items with old organization values found.');
    await sql.end();
    return;
  }

  // Group by user
  const byUser = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.user_id) continue;
    const set = byUser.get(row.user_id) ?? new Set<string>();
    set.add(row.organization);
    byUser.set(row.user_id, set);
  }

  for (const [userId, orgSlugs] of byUser) {
    console.log(`Processing user ${userId} — ${orgSlugs.size} org(s)`);
    const slugToId = new Map<string, string>();

    for (const slug of orgSlugs) {
      const name = LEGACY_ORG_NAMES[slug] ?? slug;

      // Check if org already created for this user
      const [existing] = await sql`
        SELECT id FROM organizations WHERE user_id = ${userId} AND slug = ${slug}
      ` as Array<{ id: string }>;

      let orgId: string;
      if (existing) {
        orgId = existing.id;
        console.log(`  org "${name}" already exists (${orgId})`);
      } else {
        const [created] = await sql`
          INSERT INTO organizations (user_id, name, slug) VALUES (${userId}, ${name}, ${slug})
          RETURNING id
        ` as Array<{ id: string }>;
        orgId = created.id;
        console.log(`  created org "${name}" → ${orgId}`);
      }

      slugToId.set(slug, orgId);
    }

    // Update community_items for this user
    for (const [slug, orgId] of slugToId) {
      const result = await sql`
        UPDATE community_items
        SET organization_id = ${orgId}
        WHERE user_id = ${userId} AND organization = ${slug}
      `;
      console.log(`  updated ${result.count} items for org "${slug}"`);
    }
  }

  console.log('\nMigration complete!');
  console.log('After verifying, run to drop the old column:');
  console.log('  ALTER TABLE community_items DROP COLUMN IF EXISTS organization;');

  await sql.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
