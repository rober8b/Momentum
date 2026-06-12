/**
 * db:baseline — one-time setup for a database whose schema was applied via
 * `drizzle-kit push` and therefore has no drizzle.__drizzle_migrations table.
 *
 * Without this, the first `drizzle-orm` migrate() run would try to re-run
 * 0000_baseline.sql (CREATE TABLE ...) against a database that already has
 * those tables, and fail.
 *
 * This script marks every migration currently listed in drizzle/meta/_journal.json
 * as already-applied, WITHOUT running their SQL — it only creates the bookkeeping
 * table (drizzle.__drizzle_migrations, same as migrate() would) and inserts one
 * row per journal entry, using the exact same hash/timestamp format that
 * drizzle-orm's migrate() reads.
 *
 * Idempotent / safe to re-run: if drizzle.__drizzle_migrations already has rows,
 * it does nothing and just prints the current state.
 *
 * Run locally:  npm run db:baseline:local   (reads .env.local)
 * Run against a remote DB: DATABASE_URL=... npx tsx scripts/db-baseline.ts
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const MIGRATIONS_TABLE = '__drizzle_migrations';
const MIGRATIONS_SCHEMA = 'drizzle';

type JournalEntry = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };
type Journal = { entries: JournalEntry[] };

async function run() {
  const sql = postgres(DATABASE_URL!, { max: 1 });

  const journal: Journal = JSON.parse(readFileSync('./drizzle/meta/_journal.json', 'utf-8'));

  // MIGRATIONS_SCHEMA / MIGRATIONS_TABLE are hardcoded constants (not user input),
  // so building the identifier portion of these queries with sql.unsafe is safe.
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`);
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const existing = await sql.unsafe(
    `SELECT hash, created_at FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ORDER BY created_at ASC`
  );

  if (existing.length > 0) {
    console.log('db:baseline — drizzle.__drizzle_migrations already has entries, nothing to do:');
    for (const row of existing) {
      console.log(`  hash=${row.hash} created_at=${row.created_at}`);
    }
    await sql.end();
    return;
  }

  console.log(`db:baseline — marking ${journal.entries.length} migration(s) as already applied:`);
  for (const entry of journal.entries) {
    const fileContent = readFileSync(`./drizzle/${entry.tag}.sql`, 'utf-8');
    const hash = createHash('sha256').update(fileContent).digest('hex');
    await sql.unsafe(
      `INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (hash, created_at) VALUES ($1, $2)`,
      [hash, entry.when]
    );
    console.log(`  ${entry.tag} -> hash=${hash} created_at=${entry.when}`);
  }

  console.log('db:baseline — done. `npm run db:migrate` is now safe to run.');
  await sql.end();
}

run().catch((err) => {
  console.error('db:baseline — failed:', err);
  process.exit(1);
});
