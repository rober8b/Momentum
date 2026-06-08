/**
 * db:reset — drops all data and re-runs seed:minimal (empty schema).
 *
 * Run: node --env-file=.env.local --input-type=module < scripts/db-reset.ts
 *
 * WARNING: DESTRUCTIVE. Deletes all rows from all tables.
 * Schema (table structure) is NOT dropped — use drizzle-kit for schema changes.
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const sql = postgres(DATABASE_URL, { max: 1 });

async function run() {
  console.log('db:reset — clearing all data…');

  await sql`DELETE FROM vault_exports`;
  await sql`DELETE FROM community_items`;
  await sql`DELETE FROM organizations`;
  await sql`DELETE FROM build_items`;
  await sql`DELETE FROM freelance_tasks`;
  await sql`DELETE FROM freelance_clients`;
  await sql`DELETE FROM own_projects`;
  await sql`DELETE FROM assignments`;
  await sql`DELETE FROM subjects`;
  await sql`DELETE FROM password_reset_tokens`;
  await sql`DELETE FROM login_attempts`;
  await sql`DELETE FROM audit_log`;
  await sql`DELETE FROM users`;

  console.log('db:reset done — all data cleared. Schema intact.');
  console.log('Next: run `npx drizzle-kit push` if schema is out of sync.');
  await sql.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
