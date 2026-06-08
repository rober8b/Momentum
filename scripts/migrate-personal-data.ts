/**
 * scripts/migrate-personal-data.ts
 *
 * One-time migration: backfills user_id on all existing rows.
 *
 * Usage:
 *   export DATABASE_URL=...
 *   npx tsx scripts/migrate-personal-data.ts
 *
 * This script:
 *   1. Finds the first admin user in the DB
 *   2. Updates all rows in all tables that have user_id = NULL with that user's ID
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { isNull, eq } from 'drizzle-orm';
import * as schema from '../lib/db/schema';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(sql, { schema });

async function main() {
  // Find the first admin user
  const [adminUser] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.role, 'admin'))
    .limit(1);

  if (!adminUser) {
    console.error('No admin user found. Create one first via /setup.');
    process.exit(1);
  }

  console.log(`Backfilling user_id = ${adminUser.id} (${adminUser.email})`);

  const tables = [
    { name: 'subjects', table: schema.subjects },
    { name: 'assignments', table: schema.assignments },
    { name: 'workblocks', table: schema.workblocks },
    { name: 'buildItems', table: schema.buildItems },
    { name: 'freelanceClients', table: schema.freelanceClients },
    { name: 'freelanceTasks', table: schema.freelanceTasks },
    { name: 'ownProjects', table: schema.ownProjects },
    { name: 'communityItems', table: schema.communityItems },
  ] as const;

  for (const { name, table } of tables) {
    const result = await db
      .update(table)
      .set({ user_id: adminUser.id })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(isNull((table as any).user_id))
      .returning({ id: (table as unknown as typeof schema.workblocks).id });

    console.log(`  ${name}: updated ${result.length} rows`);
  }

  console.log('Done.');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
