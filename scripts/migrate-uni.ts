/**
 * migrate:uni:local — Sprint B Phase 4 (pillar 2 of 2): migrates
 * subjects + assignments into the dynamic pillar engine (pillars/
 * pillar_items), per docs/DYNAMIC_PILLARS.md. Subjects become containers,
 * assignments become children — same hierarchy shape as Freelance. What's
 * different here: each subject carries a weekly schedule (subjects.schedule
 * jsonb), which must survive the migration as fields.schedule on the
 * CONTAINER item, not get dropped or attached to a child by mistake.
 *
 * Run: npm run migrate:uni:local
 *
 * - Read-only on subjects/assignments — never deletes or modifies the
 *   source tables.
 * - Idempotent: re-running upserts existing migrated rows (matched by
 *   fields.legacy_source + fields.legacy_id) instead of duplicating them.
 * - Migrates every user that has subjects rows, not just one — this is a
 *   local-only dev script, not the prod cutover.
 * - Subjects are migrated before assignments (an assignment's
 *   parent_item_id needs the subject's NEW pillar_item id, which only
 *   exists after the subject row is migrated). An assignment with a null
 *   subject_id (the legacy column is nullable, though the app's UI never
 *   actually produces one) is skipped with a warning, same defensive
 *   treatment migrate-freelance.ts gives an orphaned task.
 */
import postgres from 'postgres';
import { UNI_TEMPLATE } from '@/lib/pillar-templates';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const sql = postgres(DATABASE_URL, { max: 1 });

// postgres-js's sql.json() wants its own JSONValue type; our jsonb payloads
// are always plain JSON-safe data, so this just sidesteps a structural-
// typing false positive rather than widening anything actually unsafe.
function toJsonb(value: unknown): postgres.Parameter {
  return sql.json(value as Parameters<typeof sql.json>[0]);
}

const childView = UNI_TEMPLATE.config.childView;
if (!childView) throw new Error('UNI_TEMPLATE.config.childView is required for this migration');

type SubjectRow = {
  id: string;
  user_id: string;
  name: string;
  semester: string;
  schedule: unknown;
  active: boolean;
  vault_slug: string | null;
  is_sample: boolean;
  created_at: Date;
};

type AssignmentRow = {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  resources: unknown;
  is_sample: boolean;
  created_at: Date;
  completed_at: Date | null;
};

type PillarItemRow = {
  id: string;
  parent_item_id: string | null;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  completed_at: Date | null;
  is_sample: boolean;
  fields: Record<string, unknown>;
};

function isValidAssignmentStatus(status: string): boolean {
  return childView!.status_workflow.some((s) => s.key === status);
}

function subjectStatus(active: boolean): string {
  return active ? 'active' : 'inactive';
}

async function ensureUniPillar(userId: string): Promise<string> {
  const [existing] = (await sql`
    SELECT id FROM pillars WHERE user_id = ${userId} AND key = ${UNI_TEMPLATE.key}
  `) as Array<{ id: string }>;
  if (existing) return existing.id;

  const [created] = (await sql`
    INSERT INTO pillars (user_id, key, name, icon, description, position, view_type, status_workflow, config, source_template)
    VALUES (
      ${userId}, ${UNI_TEMPLATE.key}, ${UNI_TEMPLATE.name}, ${UNI_TEMPLATE.icon}, ${UNI_TEMPLATE.description},
      0, ${UNI_TEMPLATE.view_type}, ${toJsonb(UNI_TEMPLATE.status_workflow)},
      ${toJsonb(UNI_TEMPLATE.config)}, ${UNI_TEMPLATE.key}
    )
    RETURNING id
  `) as Array<{ id: string }>;
  console.log(`  created "uni" pillar for user ${userId} -> ${created.id}`);
  return created.id;
}

// Returns a map of subjects.id -> new pillar_items.id for every subject
// successfully migrated (existing or freshly inserted), so the assignment
// migration pass below can resolve parent_item_id.
async function migrateSubjects(userId: string, pillarId: string, subjects: SubjectRow[]) {
  const existingItems = (await sql`
    SELECT id, title, description, status, due_date, is_sample, fields
    FROM pillar_items WHERE pillar_id = ${pillarId} AND is_container = true
  `) as PillarItemRow[];

  const byLegacyId = new Map<string, string>();
  for (const item of existingItems) {
    if (item.fields?.legacy_source === 'subjects' && typeof item.fields.legacy_id === 'string') {
      byLegacyId.set(item.fields.legacy_id, item.id);
    }
  }

  let inserted = 0;
  let updated = 0;
  const subjectIdMap = new Map<string, string>();

  for (const s of subjects) {
    // The defining case for this migration: the schedule lives on the
    // PARENT (subject), not on a child — it must round-trip intact here.
    const fields = {
      schedule: s.schedule ?? [],
      semester: s.semester,
      vault_slug: s.vault_slug,
      legacy_source: 'subjects',
      legacy_id: s.id,
    };
    const status = subjectStatus(s.active);
    const existingItemId = byLegacyId.get(s.id);

    if (existingItemId) {
      await sql`
        UPDATE pillar_items SET
          title = ${s.name},
          status = ${status},
          is_sample = ${s.is_sample},
          fields = ${toJsonb(fields)},
          updated_at = now()
        WHERE id = ${existingItemId}
      `;
      updated++;
      subjectIdMap.set(s.id, existingItemId);
    } else {
      const [row] = (await sql`
        INSERT INTO pillar_items
          (user_id, pillar_id, is_container, title, status, is_sample, fields, created_at, updated_at)
        VALUES (
          ${userId}, ${pillarId}, true, ${s.name}, ${status}, ${s.is_sample},
          ${toJsonb(fields)}, ${s.created_at}, now()
        )
        RETURNING id
      `) as Array<{ id: string }>;
      inserted++;
      subjectIdMap.set(s.id, row.id);
    }
  }

  return { inserted, updated, subjectIdMap };
}

async function migrateAssignments(userId: string, pillarId: string, assignments: AssignmentRow[], subjectIdMap: Map<string, string>) {
  const existingItems = (await sql`
    SELECT id, title, description, status, due_date, completed_at, is_sample, fields
    FROM pillar_items WHERE pillar_id = ${pillarId} AND is_container = false
  `) as PillarItemRow[];

  const byLegacyId = new Map<string, string>();
  for (const item of existingItems) {
    if (item.fields?.legacy_source === 'assignments' && typeof item.fields.legacy_id === 'string') {
      byLegacyId.set(item.fields.legacy_id, item.id);
    }
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const a of assignments) {
    if (!a.subject_id || !subjectIdMap.has(a.subject_id)) {
      console.warn(`  SKIP assignment ${a.id} ("${a.title}"): no migrated subject for subject_id ${a.subject_id}`);
      skipped++;
      continue;
    }
    if (!isValidAssignmentStatus(a.status)) {
      console.warn(`  SKIP assignment ${a.id} ("${a.title}"): invalid status "${a.status}"`);
      skipped++;
      continue;
    }

    const parentItemId = subjectIdMap.get(a.subject_id)!;
    const fields = {
      resources: a.resources ?? [],
      legacy_source: 'assignments',
      legacy_id: a.id,
    };
    const existingItemId = byLegacyId.get(a.id);

    if (existingItemId) {
      await sql`
        UPDATE pillar_items SET
          parent_item_id = ${parentItemId},
          title = ${a.title},
          description = ${a.description},
          status = ${a.status},
          due_date = ${a.due_date},
          completed_at = ${a.completed_at},
          is_sample = ${a.is_sample},
          fields = ${toJsonb(fields)},
          updated_at = now()
        WHERE id = ${existingItemId}
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO pillar_items
          (user_id, pillar_id, parent_item_id, is_container, title, description, status, due_date, completed_at, is_sample, fields, created_at, updated_at)
        VALUES (
          ${userId}, ${pillarId}, ${parentItemId}, false, ${a.title}, ${a.description}, ${a.status}, ${a.due_date}, ${a.completed_at}, ${a.is_sample},
          ${toJsonb(fields)}, ${a.created_at}, now()
        )
      `;
      inserted++;
    }
  }

  return { inserted, updated, skipped };
}

// Re-derives the original shape of both source tables from the migrated
// pillar_items and diffs against the source rows. Per docs/DYNAMIC_PILLARS.md:
// "verify with round-trip diffs, not row counts." Special attention here:
// fields.schedule must survive on each subject, untouched.
async function roundTripDiff(userId: string, subjects: SubjectRow[], assignments: AssignmentRow[]): Promise<string[]> {
  const allItems = (await sql`
    SELECT pi.id, pi.parent_item_id, pi.is_container, pi.title, pi.description, pi.status, pi.due_date, pi.completed_at, pi.is_sample, pi.fields
    FROM pillar_items pi
    JOIN pillars p ON p.id = pi.pillar_id
    WHERE p.user_id = ${userId} AND p.key = ${UNI_TEMPLATE.key}
  `) as Array<PillarItemRow & { is_container: boolean }>;

  const subjectItemByLegacyId = new Map<string, typeof allItems[number]>();
  const assignmentItemByLegacyId = new Map<string, typeof allItems[number]>();
  for (const item of allItems) {
    if (item.fields?.legacy_source === 'subjects' && typeof item.fields.legacy_id === 'string') {
      subjectItemByLegacyId.set(item.fields.legacy_id, item);
    }
    if (item.fields?.legacy_source === 'assignments' && typeof item.fields.legacy_id === 'string') {
      assignmentItemByLegacyId.set(item.fields.legacy_id, item);
    }
  }

  const mismatches: string[] = [];

  for (const s of subjects) {
    const migrated = subjectItemByLegacyId.get(s.id);
    if (!migrated) {
      mismatches.push(`subject ${s.id} ("${s.name}") has no migrated pillar_item`);
      continue;
    }
    const original: Record<string, unknown> = {
      name: s.name, semester: s.semester, schedule: s.schedule ?? [],
      active: s.active, vault_slug: s.vault_slug, is_sample: s.is_sample,
    };
    const rederived: Record<string, unknown> = {
      name: migrated.title, semester: migrated.fields.semester ?? null, schedule: migrated.fields.schedule ?? [],
      active: migrated.status === 'active', vault_slug: migrated.fields.vault_slug ?? null, is_sample: migrated.is_sample,
    };
    const diffFields = Object.keys(original).filter((k) => JSON.stringify(original[k]) !== JSON.stringify(rederived[k]));
    if (!migrated.is_container) diffFields.push('is_container (expected true)');
    if (diffFields.length > 0) mismatches.push(`subject ${s.id} ("${s.name}") mismatched: ${diffFields.join(', ')}`);
  }

  for (const a of assignments) {
    const migrated = assignmentItemByLegacyId.get(a.id);
    if (!migrated) {
      if (a.subject_id && isValidAssignmentStatus(a.status)) mismatches.push(`assignment ${a.id} ("${a.title}") has no migrated pillar_item`);
      continue;
    }
    const expectedParentItem = a.subject_id ? subjectItemByLegacyId.get(a.subject_id) : undefined;
    const original: Record<string, unknown> = {
      title: a.title, description: a.description, status: a.status, due_date: a.due_date,
      completed_at: a.completed_at ? a.completed_at.toISOString() : null,
      resources: a.resources ?? [], is_sample: a.is_sample,
      parent_item_id: expectedParentItem?.id ?? null,
    };
    const rederived: Record<string, unknown> = {
      title: migrated.title, description: migrated.description, status: migrated.status, due_date: migrated.due_date,
      completed_at: migrated.completed_at ? migrated.completed_at.toISOString() : null,
      resources: migrated.fields.resources ?? [], is_sample: migrated.is_sample,
      parent_item_id: migrated.parent_item_id,
    };
    const diffFields = Object.keys(original).filter((k) => JSON.stringify(original[k]) !== JSON.stringify(rederived[k]));
    if (migrated.is_container) diffFields.push('is_container (expected false)');
    if (diffFields.length > 0) mismatches.push(`assignment ${a.id} ("${a.title}") mismatched: ${diffFields.join(', ')}`);
  }

  return mismatches;
}

async function run() {
  console.log('migrate:uni — subjects/assignments -> pillars/pillar_items (read-only on source tables)\n');

  const allSubjects = (await sql`SELECT * FROM subjects WHERE user_id IS NOT NULL`) as SubjectRow[];
  const allAssignments = (await sql`SELECT * FROM assignments WHERE user_id IS NOT NULL`) as AssignmentRow[];

  if (allSubjects.length === 0) {
    console.log('No subjects rows found — nothing to migrate.');
    await sql.end();
    return;
  }

  const subjectsByUser = new Map<string, SubjectRow[]>();
  for (const s of allSubjects) {
    const list = subjectsByUser.get(s.user_id) ?? [];
    list.push(s);
    subjectsByUser.set(s.user_id, list);
  }
  const assignmentsByUser = new Map<string, AssignmentRow[]>();
  for (const a of allAssignments) {
    const list = assignmentsByUser.get(a.user_id) ?? [];
    list.push(a);
    assignmentsByUser.set(a.user_id, list);
  }

  let totals = { subjectsInserted: 0, subjectsUpdated: 0, assignmentsInserted: 0, assignmentsUpdated: 0, assignmentsSkipped: 0 };
  const allMismatches: string[] = [];

  for (const [userId, subjects] of subjectsByUser) {
    const assignments = assignmentsByUser.get(userId) ?? [];
    console.log(`user ${userId} — ${subjects.length} subject(s), ${assignments.length} assignment(s)`);

    const pillarId = await ensureUniPillar(userId);
    const subjectResult = await migrateSubjects(userId, pillarId, subjects);
    console.log(`  subjects    — inserted: ${subjectResult.inserted}, updated: ${subjectResult.updated}`);

    const assignmentResult = await migrateAssignments(userId, pillarId, assignments, subjectResult.subjectIdMap);
    console.log(`  assignments — inserted: ${assignmentResult.inserted}, updated: ${assignmentResult.updated}, skipped: ${assignmentResult.skipped}`);

    totals.subjectsInserted += subjectResult.inserted;
    totals.subjectsUpdated += subjectResult.updated;
    totals.assignmentsInserted += assignmentResult.inserted;
    totals.assignmentsUpdated += assignmentResult.updated;
    totals.assignmentsSkipped += assignmentResult.skipped;

    const mismatches = await roundTripDiff(userId, subjects, assignments);
    allMismatches.push(...mismatches);
  }

  console.log('\n--- Summary ---');
  console.log(`users processed: ${subjectsByUser.size}`);
  console.log(`subjects    — inserted: ${totals.subjectsInserted}, updated: ${totals.subjectsUpdated}`);
  console.log(`assignments — inserted: ${totals.assignmentsInserted}, updated: ${totals.assignmentsUpdated}, skipped: ${totals.assignmentsSkipped}`);

  console.log('\n--- Round-trip diff verification ---');
  if (allMismatches.length === 0) {
    console.log('OK — every migrated subject (including fields.schedule) and assignment round-trips losslessly through pillar_items.');
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
