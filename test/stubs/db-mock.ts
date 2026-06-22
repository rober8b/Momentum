// Mock replacement for '@/lib/db', used via:
//   vi.mock('@/lib/db', () => import('<relative path to this file>'));
//
// Both the vi.mock factory and the test file import this exact module, so
// there's no closure-over-uninitialized-const hazard from vi.mock hoisting —
// everything here is a plain module export.
//
// Usage in a test file:
//   vi.mock('@/lib/db', () => import('../../test/stubs/db-mock'));
//   import { queueResult, resetDbMock } from '../../test/stubs/db-mock';
//   beforeEach(() => resetDbMock());
//   queueResult([{ id: '1', active: true }]); // first db query in the code under test resolves to this

import { vi } from 'vitest';
export * as schema from '@/lib/db/schema';

type Row = Record<string, unknown>;

const resultQueue: Row[][] = [];

/** Queue the result for the next sequential db query (select/update/insert...returning). */
export function queueResult(rows: Row[]): void {
  resultQueue.push(rows);
}

/** Clear queued results and call history between tests. */
export function resetDbMock(): void {
  resultQueue.length = 0;
  db.select.mockClear();
  db.insert.mockClear();
  db.update.mockClear();
  db.delete.mockClear();
  db.transaction.mockClear();
}

function nextResult(): Row[] {
  return resultQueue.length > 0 ? resultQueue.shift()! : [];
}

const CHAIN_METHODS = ['from', 'where', 'limit', 'offset', 'orderBy', 'leftJoin', 'innerJoin', 'groupBy', 'set', 'values'] as const;

function makeChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  for (const m of CHAIN_METHODS) {
    chain[m] = vi.fn(() => chain);
  }
  chain.returning = vi.fn(() => Promise.resolve(nextResult()));
  chain.then = (resolve: (rows: Row[]) => unknown, reject?: (err: unknown) => unknown) =>
    Promise.resolve(nextResult()).then(resolve, reject);
  chain.catch = (reject: (err: unknown) => unknown) => Promise.resolve(nextResult()).catch(reject);
  return chain;
}

export const db = {
  select: vi.fn(() => makeChain()),
  insert: vi.fn(() => makeChain()),
  update: vi.fn(() => makeChain()),
  delete: vi.fn(() => makeChain()),
  transaction: vi.fn(async (cb: (tx: typeof db) => unknown) => cb(db)),
};
