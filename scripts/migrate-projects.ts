/**
 * migrate:projects:local — Sprint B Phase 2: migrates own_projects rows into
 * the dynamic pillar engine (pillars/pillar_items), per docs/DYNAMIC_PILLARS.md.
 *
 * Run: npm run migrate:projects:local
 *
 * - Read-only on own_projects — never deletes or modifies the source table.
 * - Idempotent: re-running upserts existing migrated rows (matched by
 *   fields.legacy_source + fields.legacy_id) instead of duplicating them.
 *   Items without that marker (e.g. created by hand at /p/projects during
 *   Sprint B Phase 1 testing) are left alone.
 * - Migrates every user that has own_projects rows, not just one — this is a
 *   local-only dev script, not the prod cutover.
 */
import postgres from 'postgres';
import { PROJECTS_TEMPLATE } from '@/lib/pillar-templates';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const sql = postgres(DATABASE_URL, { max: 1 });

// postgres-js's sql.json() wants its own JSONValue type; our jsonb payloads
// are always plain JSON-safe data (template config, fields bags), so this
// just sidesteps a structural-typing false positive rather than widening
// anything actually unsafe.
function toJsonb(value: unknown): postgres.Parameter {
  return sql.json(value as Parameters<typeof sql.json>[0]);
}

type OwnProjectRow = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  description: string | null;
  status: string;
  last_update: string | null;
  next_step: string | null;
  links: Record<string, string>;
  is_sample: boolean;
  created_at: Date;
  updated_at: Date;
};

type PillarItemRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  is_sample: boolean;
  fields: Record<string, unknown>;
};

function isValidStatus(status: string): boolean {
  return PROJECTS_TEMPLATE.status_workflow.some((s) => s.key === status);
}

function isTerminal(status: string): boolean {
  return PROJECTS_TEMPLATE.status_workflow.find((s) => s.key === status)?.is_terminal ?? false;
}

async function ensureProjectsPillar(userId: string): Promise<string> {
  const [existing] = (await sql`
    SELECT id FROM pillars WHERE user_id = ${userId} AND key = ${PROJECTS_TEMPLATE.key}
  `) as Array<{ id: string }>;
  if (existing) return existing.id;

  const [created] = (await sql`
    INSERT INTO pillars (user_id, key, name, icon, description, position, view_type, status_workflow, config, source_template)
    VALUES (
      ${userId}, ${PROJECTS_TEMPLATE.key}, ${PROJECTS_TEMPLATE.name}, ${PROJECTS_TEMPLATE.icon}, ${PROJECTS_TEMPLATE.description},
      0, ${PROJECTS_TEMPLATE.view_type}, ${toJsonb(PROJECTS_TEMPLATE.status_workflow)},
      ${toJsonb(PROJECTS_TEMPLATE.config)}, ${PROJECTS_TEMPLATE.key}
    )
    RETURNING id
  `) as Array<{ id: string }>;
  console.log(`  created "projects" pillar for user ${userId} -> ${created.id}`);
  return created.id;
}

async function migrateUser(userId: string, ownProjects: OwnProjectRow[]) {
  const pillarId = await ensureProjectsPillar(userId);

  const existingItems = (await sql`
    SELECT id, title, description, status, is_sample, fields FROM pillar_items WHERE pillar_id = ${pillarId}
  `) as PillarItemRow[];

  const byLegacyId = new Map<string, string>();
  for (const item of existingItems) {
    if (item.fields?.legacy_source === 'own_projects' && typeof item.fields.legacy_id === 'string') {
      byLegacyId.set(item.fields.legacy_id, item.id);
    }
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of ownProjects) {
    if (!isValidStatus(p.status)) {
      console.warn(`  SKIP own_project ${p.id} ("${p.name}"): invalid status "${p.status}" for the projects pillar`);
      skipped++;
      continue;
    }

    const fields = {
      icon: p.icon,
      last_update: p.last_update,
      next_step: p.next_step,
      links: p.links,
      legacy_source: 'own_projects',
      legacy_id: p.id,
    };
    const completedAt = isTerminal(p.status) ? p.updated_at : null;
    const existingItemId = byLegacyId.get(p.id);

    if (existingItemId) {
      await sql`
        UPDATE pillar_items SET
          title = ${p.name},
          description = ${p.description},
          status = ${p.status},
          completed_at = ${completedAt},
          is_sample = ${p.is_sample},
          fields = ${toJsonb(fields)},
          updated_at = ${p.updated_at}
        WHERE id = ${existingItemId}
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO pillar_items
          (user_id, pillar_id, is_container, title, description, status, completed_at, is_sample, fields, created_at, updated_at)
        VALUES (
          ${userId}, ${pillarId}, false, ${p.name}, ${p.description}, ${p.status}, ${completedAt}, ${p.is_sample},
          ${toJsonb(fields)}, ${p.created_at}, ${p.updated_at}
        )
      `;
      inserted++;
    }
  }

  return { inserted, updated, skipped };
}

// Re-derives the original own_projects shape from each migrated pillar_item
// and diffs it against the source row — catches a forgotten/mismapped field
// that a row-count match would miss. Per docs/DYNAMIC_PILLARS.md: "verify
// with round-trip diffs, not row counts."
async function roundTripDiff(userId: string, ownProjects: OwnProjectRow[]): Promise<string[]> {
  const pillarItems = (await sql`
    SELECT pi.id, pi.title, pi.description, pi.status, pi.is_sample, pi.fields
    FROM pillar_items pi
    JOIN pillars p ON p.id = pi.pillar_id
    WHERE p.user_id = ${userId} AND p.key = ${PROJECTS_TEMPLATE.key}
  `) as PillarItemRow[];

  const byLegacyId = new Map<string, PillarItemRow>();
  for (const item of pillarItems) {
    if (item.fields?.legacy_source === 'own_projects' && typeof item.fields.legacy_id === 'string') {
      byLegacyId.set(item.fields.legacy_id, item);
    }
  }

  const mismatches: string[] = [];
  for (const p of ownProjects) {
    const migrated = byLegacyId.get(p.id);
    if (!migrated) {
      if (isValidStatus(p.status)) {
        mismatches.push(`own_project ${p.id} ("${p.name}") has no migrated pillar_item`);
      }
      continue;
    }

    const original: Record<string, unknown> = {
      name: p.name,
      description: p.description,
      status: p.status,
      icon: p.icon,
      last_update: p.last_update,
      next_step: p.next_step,
      links: p.links,
      is_sample: p.is_sample,
    };
    const rederived: Record<string, unknown> = {
      name: migrated.title,
      description: migrated.description,
      status: migrated.status,
      icon: migrated.fields.icon ?? null,
      last_update: migrated.fields.last_update ?? null,
      next_step: migrated.fields.next_step ?? null,
      links: migrated.fields.links ?? {},
      is_sample: migrated.is_sample,
    };

    const diffFields = Object.keys(original).filter(
      (k) => JSON.stringify(original[k]) !== JSON.stringify(rederived[k]),
    );
    if (diffFields.length > 0) {
      mismatches.push(`own_project ${p.id} ("${p.name}") mismatched fields: ${diffFields.join(', ')}`);
    }
  }
  return mismatches;
}

async function run() {
  console.log('migrate:projects — own_projects -> pillars/pillar_items (read-only on own_projects)\n');

  const allProjects = (await sql`
    SELECT * FROM own_projects WHERE user_id IS NOT NULL
  `) as OwnProjectRow[];

  if (allProjects.length === 0) {
    console.log('No own_projects rows found — nothing to migrate.');
    await sql.end();
    return;
  }

  const byUser = new Map<string, OwnProjectRow[]>();
  for (const p of allProjects) {
    const list = byUser.get(p.user_id) ?? [];
    list.push(p);
    byUser.set(p.user_id, list);
  }

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const allMismatches: string[] = [];

  for (const [userId, projects] of byUser) {
    console.log(`user ${userId} — ${projects.length} own_project row(s)`);
    const { inserted, updated, skipped } = await migrateUser(userId, projects);
    console.log(`  inserted: ${inserted}, updated: ${updated}, skipped: ${skipped}`);
    totalInserted += inserted;
    totalUpdated += updated;
    totalSkipped += skipped;

    const mismatches = await roundTripDiff(userId, projects);
    allMismatches.push(...mismatches);
  }

  console.log('\n--- Summary ---');
  console.log(`users processed: ${byUser.size}`);
  console.log(`inserted: ${totalInserted}, updated: ${totalUpdated}, skipped (invalid status): ${totalSkipped}`);

  console.log('\n--- Round-trip diff verification ---');
  if (allMismatches.length === 0) {
    console.log('OK — every migrated own_projects row round-trips losslessly through pillar_items.');
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
