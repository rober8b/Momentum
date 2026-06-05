// Postgres client (Railway) + Drizzle ORM.
// Reemplaza lib/supabase.ts y lib/supabase-server.ts.

import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __pg: ReturnType<typeof postgres> | undefined;
}

// Singleton para no abrir N conexiones en hot reload de Next dev.
function client() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  if (!globalThis.__pg) {
    globalThis.__pg = postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
    });
  }
  return globalThis.__pg;
}

export const db = drizzle(client(), { schema, casing: 'snake_case' });
export { schema };
