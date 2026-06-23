/**
 * migrate:freelance:local — Sprint B Phase 3: migrates freelance_clients +
 * freelance_tasks into the dynamic pillar engine (pillars/pillar_items),
 * per docs/DYNAMIC_PILLARS.md. This is the first migration with hierarchy:
 * each client becomes a container item, each of its tasks becomes a child
 * item (parent_item_id pointing at the client's new pillar_item id).
 *
 * Run: npm run migrate:freelance:local
 *
 * - Read-only on freelance_clients/freelance_tasks — never deletes or
 *   modifies the source tables.
 * - Idempotent: re-running upserts existing migrated rows (matched by
 *   fields.legacy_source + fields.legacy_id) instead of duplicating them.
 *   Items without that marker (e.g. created by hand during testing) are
 *   left alone.
 * - Migrates every user that has freelance_clients rows, not just one —
 *   this is a local-only dev script, not the prod cutover.
 * - Clients are migrated before tasks (a task's parent_item_id needs the
 *   client's NEW pillar_item id, which only exists after the client row is
 *   migrated).
 */
import postgres from 'postgres';
import { FREELANCE_TEMPLATE } from '@/lib/pillar-templates';

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

const childView = FREELANCE_TEMPLATE.config.childView;
if (!childView) throw new Error('FREELANCE_TEMPLATE.config.childView is required for this migration');

type ClientRow = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  description: string | null;
  status: string;
  stack: string | null;
  next_step: string | null;
  last_update: string | null;
  links: Record<string, string>;
  is_sample: boolean;
  created_at: Date;
  updated_at: Date;
};

type TaskRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
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
  is_sample: boolean;
  fields: Record<string, unknown>;
};

function isValidClientStatus(status: string): boolean {
  return FREELANCE_TEMPLATE.status_workflow.some((s) => s.key === status);
}

function isClientTerminal(status: string): boolean {
  return FREELANCE_TEMPLATE.status_workflow.find((s) => s.key === status)?.is_terminal ?? false;
}

function isValidTaskStatus(status: string): boolean {
  return childView!.status_workflow.some((s) => s.key === status);
}

async function ensureFreelancePillar(userId: string): Promise<string> {
  const [existing] = (await sql`
    SELECT id FROM pillars WHERE user_id = ${userId} AND key = ${FREELANCE_TEMPLATE.key}
  `) as Array<{ id: string }>;
  if (existing) return existing.id;

  const [created] = (await sql`
    INSERT INTO pillars (user_id, key, name, icon, description, position, view_type, status_workflow, config, source_template)
    VALUES (
      ${userId}, ${FREELANCE_TEMPLATE.key}, ${FREELANCE_TEMPLATE.name}, ${FREELANCE_TEMPLATE.icon}, ${FREELANCE_TEMPLATE.description},
      0, ${FREELANCE_TEMPLATE.view_type}, ${toJsonb(FREELANCE_TEMPLATE.status_workflow)},
      ${toJsonb(FREELANCE_TEMPLATE.config)}, ${FREELANCE_TEMPLATE.key}
    )
    RETURNING id
  `) as Array<{ id: string }>;
  console.log(`  created "freelance" pillar for user ${userId} -> ${created.id}`);
  return created.id;
}

// Returns a map of freelance_clients.id -> new pillar_items.id for every
// client successfully migrated (existing or freshly inserted), so the task
// migration pass below can resolve parent_item_id.
async function migrateClients(userId: string, pillarId: string, clients: ClientRow[]) {
  const existingItems = (await sql`
    SELECT id, title, description, status, due_date, is_sample, fields
    FROM pillar_items WHERE pillar_id = ${pillarId} AND is_container = true
  `) as PillarItemRow[];

  const byLegacyId = new Map<string, string>();
  for (const item of existingItems) {
    if (item.fields?.legacy_source === 'freelance_clients' && typeof item.fields.legacy_id === 'string') {
      byLegacyId.set(item.fields.legacy_id, item.id);
    }
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const clientIdMap = new Map<string, string>();

  for (const c of clients) {
    if (!isValidClientStatus(c.status)) {
      console.warn(`  SKIP freelance_client ${c.id} ("${c.name}"): invalid status "${c.status}"`);
      skipped++;
      continue;
    }

    const fields = {
      icon: c.icon,
      stack: c.stack,
      next_step: c.next_step,
      last_update: c.last_update,
      links: c.links,
      legacy_source: 'freelance_clients',
      legacy_id: c.id,
    };
    const completedAt = isClientTerminal(c.status) ? c.updated_at : null;
    const existingItemId = byLegacyId.get(c.id);

    if (existingItemId) {
      await sql`
        UPDATE pillar_items SET
          title = ${c.name},
          description = ${c.description},
          status = ${c.status},
          completed_at = ${completedAt},
          is_sample = ${c.is_sample},
          fields = ${toJsonb(fields)},
          updated_at = ${c.updated_at}
        WHERE id = ${existingItemId}
      `;
      updated++;
      clientIdMap.set(c.id, existingItemId);
    } else {
      const [row] = (await sql`
        INSERT INTO pillar_items
          (user_id, pillar_id, is_container, title, description, status, completed_at, is_sample, fields, created_at, updated_at)
        VALUES (
          ${userId}, ${pillarId}, true, ${c.name}, ${c.description}, ${c.status}, ${completedAt}, ${c.is_sample},
          ${toJsonb(fields)}, ${c.created_at}, ${c.updated_at}
        )
        RETURNING id
      `) as Array<{ id: string }>;
      inserted++;
      clientIdMap.set(c.id, row.id);
    }
  }

  return { inserted, updated, skipped, clientIdMap };
}

async function migrateTasks(userId: string, pillarId: string, tasks: TaskRow[], clientIdMap: Map<string, string>) {
  const existingItems = (await sql`
    SELECT id, title, description, status, due_date, is_sample, fields
    FROM pillar_items WHERE pillar_id = ${pillarId} AND is_container = false
  `) as PillarItemRow[];

  const byLegacyId = new Map<string, string>();
  for (const item of existingItems) {
    if (item.fields?.legacy_source === 'freelance_tasks' && typeof item.fields.legacy_id === 'string') {
      byLegacyId.set(item.fields.legacy_id, item.id);
    }
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const t of tasks) {
    if (!t.client_id || !clientIdMap.has(t.client_id)) {
      console.warn(`  SKIP freelance_task ${t.id} ("${t.title}"): no migrated client for client_id ${t.client_id}`);
      skipped++;
      continue;
    }
    if (!isValidTaskStatus(t.status)) {
      console.warn(`  SKIP freelance_task ${t.id} ("${t.title}"): invalid status "${t.status}"`);
      skipped++;
      continue;
    }

    const parentItemId = clientIdMap.get(t.client_id)!;
    const fields = {
      priority: t.priority,
      legacy_source: 'freelance_tasks',
      legacy_id: t.id,
    };
    const existingItemId = byLegacyId.get(t.id);

    if (existingItemId) {
      await sql`
        UPDATE pillar_items SET
          parent_item_id = ${parentItemId},
          title = ${t.title},
          description = ${t.description},
          status = ${t.status},
          due_date = ${t.due_date},
          completed_at = ${t.completed_at},
          is_sample = ${t.is_sample},
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
          ${userId}, ${pillarId}, ${parentItemId}, false, ${t.title}, ${t.description}, ${t.status}, ${t.due_date}, ${t.completed_at}, ${t.is_sample},
          ${toJsonb(fields)}, ${t.created_at}, now()
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
async function roundTripDiff(userId: string, clients: ClientRow[], tasks: TaskRow[]): Promise<string[]> {
  const items = (await sql`
    SELECT pi.id, pi.parent_item_id, pi.is_container, pi.title, pi.description, pi.status, pi.due_date, pi.completed_at, pi.is_sample, pi.fields
    FROM pillar_items pi
    JOIN pillars p ON p.id = pi.pillar_id
    WHERE p.user_id = ${userId} AND p.key = ${FREELANCE_TEMPLATE.key}
  `) as Array<PillarItemRow & { parent_item_id: string | null; is_container: boolean; completed_at: Date | null }>;

  const clientItemByLegacyId = new Map<string, typeof items[number]>();
  const taskItemByLegacyId = new Map<string, typeof items[number]>();
  for (const item of items) {
    if (item.fields?.legacy_source === 'freelance_clients' && typeof item.fields.legacy_id === 'string') {
      clientItemByLegacyId.set(item.fields.legacy_id, item);
    }
    if (item.fields?.legacy_source === 'freelance_tasks' && typeof item.fields.legacy_id === 'string') {
      taskItemByLegacyId.set(item.fields.legacy_id, item);
    }
  }

  const mismatches: string[] = [];

  for (const c of clients) {
    const migrated = clientItemByLegacyId.get(c.id);
    if (!migrated) {
      if (isValidClientStatus(c.status)) mismatches.push(`freelance_client ${c.id} ("${c.name}") has no migrated pillar_item`);
      continue;
    }
    const original: Record<string, unknown> = {
      name: c.name, description: c.description, status: c.status,
      icon: c.icon, stack: c.stack, next_step: c.next_step, last_update: c.last_update, links: c.links, is_sample: c.is_sample,
    };
    const rederived: Record<string, unknown> = {
      name: migrated.title, description: migrated.description, status: migrated.status,
      icon: migrated.fields.icon ?? null, stack: migrated.fields.stack ?? null,
      next_step: migrated.fields.next_step ?? null, last_update: migrated.fields.last_update ?? null,
      links: migrated.fields.links ?? {}, is_sample: migrated.is_sample,
    };
    const diffFields = Object.keys(original).filter((k) => JSON.stringify(original[k]) !== JSON.stringify(rederived[k]));
    if (!migrated.is_container) diffFields.push('is_container (expected true)');
    if (diffFields.length > 0) mismatches.push(`freelance_client ${c.id} ("${c.name}") mismatched: ${diffFields.join(', ')}`);
  }

  for (const t of tasks) {
    const migrated = taskItemByLegacyId.get(t.id);
    if (!migrated) {
      if (t.client_id && isValidTaskStatus(t.status)) mismatches.push(`freelance_task ${t.id} ("${t.title}") has no migrated pillar_item`);
      continue;
    }
    const expectedParentItem = t.client_id ? clientItemByLegacyId.get(t.client_id) : undefined;
    const original: Record<string, unknown> = {
      title: t.title, description: t.description, status: t.status, due_date: t.due_date,
      completed_at: t.completed_at ? t.completed_at.toISOString() : null,
      priority: t.priority, is_sample: t.is_sample,
      parent_item_id: expectedParentItem?.id ?? null,
    };
    const rederived: Record<string, unknown> = {
      title: migrated.title, description: migrated.description, status: migrated.status, due_date: migrated.due_date,
      completed_at: migrated.completed_at ? migrated.completed_at.toISOString() : null,
      priority: migrated.fields.priority ?? null, is_sample: migrated.is_sample,
      parent_item_id: migrated.parent_item_id,
    };
    const diffFields = Object.keys(original).filter((k) => JSON.stringify(original[k]) !== JSON.stringify(rederived[k]));
    if (diffFields.length > 0) mismatches.push(`freelance_task ${t.id} ("${t.title}") mismatched: ${diffFields.join(', ')}`);
  }

  return mismatches;
}

async function run() {
  console.log('migrate:freelance — freelance_clients/freelance_tasks -> pillars/pillar_items (read-only on source tables)\n');

  const allClients = (await sql`SELECT * FROM freelance_clients WHERE user_id IS NOT NULL`) as ClientRow[];
  const allTasks = (await sql`SELECT * FROM freelance_tasks WHERE user_id IS NOT NULL`) as TaskRow[];

  if (allClients.length === 0) {
    console.log('No freelance_clients rows found — nothing to migrate.');
    await sql.end();
    return;
  }

  const clientsByUser = new Map<string, ClientRow[]>();
  for (const c of allClients) {
    const list = clientsByUser.get(c.user_id) ?? [];
    list.push(c);
    clientsByUser.set(c.user_id, list);
  }
  const tasksByUser = new Map<string, TaskRow[]>();
  for (const t of allTasks) {
    const list = tasksByUser.get(t.user_id) ?? [];
    list.push(t);
    tasksByUser.set(t.user_id, list);
  }

  let totals = { clientsInserted: 0, clientsUpdated: 0, clientsSkipped: 0, tasksInserted: 0, tasksUpdated: 0, tasksSkipped: 0 };
  const allMismatches: string[] = [];

  for (const [userId, clients] of clientsByUser) {
    const tasks = tasksByUser.get(userId) ?? [];
    console.log(`user ${userId} — ${clients.length} client(s), ${tasks.length} task(s)`);

    const pillarId = await ensureFreelancePillar(userId);
    const clientResult = await migrateClients(userId, pillarId, clients);
    console.log(`  clients — inserted: ${clientResult.inserted}, updated: ${clientResult.updated}, skipped: ${clientResult.skipped}`);

    const taskResult = await migrateTasks(userId, pillarId, tasks, clientResult.clientIdMap);
    console.log(`  tasks   — inserted: ${taskResult.inserted}, updated: ${taskResult.updated}, skipped: ${taskResult.skipped}`);

    totals.clientsInserted += clientResult.inserted;
    totals.clientsUpdated += clientResult.updated;
    totals.clientsSkipped += clientResult.skipped;
    totals.tasksInserted += taskResult.inserted;
    totals.tasksUpdated += taskResult.updated;
    totals.tasksSkipped += taskResult.skipped;

    const mismatches = await roundTripDiff(userId, clients, tasks);
    allMismatches.push(...mismatches);
  }

  console.log('\n--- Summary ---');
  console.log(`users processed: ${clientsByUser.size}`);
  console.log(`clients — inserted: ${totals.clientsInserted}, updated: ${totals.clientsUpdated}, skipped: ${totals.clientsSkipped}`);
  console.log(`tasks   — inserted: ${totals.tasksInserted}, updated: ${totals.tasksUpdated}, skipped: ${totals.tasksSkipped}`);

  console.log('\n--- Round-trip diff verification ---');
  if (allMismatches.length === 0) {
    console.log('OK — every migrated client and task round-trips losslessly through pillar_items.');
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
