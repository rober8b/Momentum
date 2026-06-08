import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbStatus: 'connected' | 'error' = 'connected';
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    dbStatus = 'error';
  }

  const body = {
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    version: '0.1.0',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  };

  return Response.json(body, { status: dbStatus === 'connected' ? 200 : 503 });
}
