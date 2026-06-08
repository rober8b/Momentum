/**
 * seed:minimal — applies schema, no data.
 * Run: node --env-file=.env.local --input-type=module < scripts/seed-minimal.ts
 *
 * This script just verifies DB connectivity. Schema is managed by drizzle-kit.
 * Run `npx drizzle-kit push` before this if schema is out of date.
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const sql = postgres(DATABASE_URL, { max: 1 });

async function run() {
  console.log('seed:minimal — checking DB connectivity…');
  const [{ now }] = await sql`SELECT now()` as Array<{ now: Date }>;
  console.log(`Connected. DB time: ${now.toISOString()}`);
  console.log('Schema is managed by drizzle-kit. Run `npx drizzle-kit push` to sync.');
  console.log('seed:minimal done — schema empty, no data inserted.');
  await sql.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
