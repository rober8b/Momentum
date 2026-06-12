/**
 * db:migrate — applies pending Drizzle migrations from drizzle/ to DATABASE_URL.
 *
 * Run locally:  npm run db:migrate:local   (reads .env.local)
 * Run in CI/CD: npm run db:migrate         (reads DATABASE_URL from process.env)
 *
 * Safe to run repeatedly: drizzle's migrate() tracks applied migrations in
 * drizzle.__drizzle_migrations and is a no-op if everything is already applied.
 *
 * NOTE: a database that was schema-synced via `drizzle-kit push` (not `migrate`)
 * has no drizzle.__drizzle_migrations table yet. Run `npm run db:baseline` once
 * against that database BEFORE the first db:migrate run — see scripts/db-baseline.ts.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

async function run() {
  const sql = postgres(DATABASE_URL!, { max: 1 });
  const db = drizzle(sql);

  console.log('db:migrate — applying pending migrations from ./drizzle ...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('db:migrate — done, schema is up to date.');

  await sql.end();
}

run().catch((err) => {
  console.error('db:migrate — failed:', err);
  process.exit(1);
});
