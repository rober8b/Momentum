import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => import('../../test/stubs/db-mock'));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock('@/lib/auth', () => ({ requireUser: requireUserMock }));

// Mock pillar-writes so we can inspect insertPillarItem calls
// and control LeafItemLimitError throws without real DB.
vi.mock('@/lib/pillar-writes', () => {
  class LeafItemLimitError extends Error {
    readonly code = 'limit_reached' as const;
    constructor(public readonly limit: number) {
      super(`plan limit reached (${limit} items)`);
    }
  }
  let n = 0;
  return {
    insertPillarItem: vi.fn(async () => `item-${++n}`),
    LeafItemLimitError,
  };
});

import { db, queueResult, resetDbMock } from '../../test/stubs/db-mock';
import { insertPillarItem, LeafItemLimitError } from '@/lib/pillar-writes';
import { materializeOnboarding } from './actions';
import type { ConfirmedStructure } from './types';

// ---------- fixtures ----------

const USER = {
  id: 'user-abc',
  settings: { onboarding_completed: false, language: 'es', timezone: 'America/Buenos_Aires' },
};

const USER_COMPLETED = {
  ...USER,
  settings: { ...USER.settings, onboarding_completed: true },
};

// Minimal flat structure: 1 pillar (work) with 2 leaf items
const FLAT_STRUCTURE: ConfirmedStructure = {
  pillars: [
    {
      templateKey: 'work',
      items: [
        { title: 'revisar PRs', status: 'backlog', fields: { type: 'task', priority: 'med' }, is_container: false, children: [] },
        { title: 'cerrar ticket', status: 'backlog', fields: { type: 'task', priority: 'med' }, is_container: false, children: [] },
      ],
    },
  ],
};

// Hierarchical structure: 1 pillar (uni) with 1 container and 2 children
const HIERARCHICAL_STRUCTURE: ConfirmedStructure = {
  pillars: [
    {
      templateKey: 'uni',
      items: [
        {
          title: 'Cálculo',
          status: 'active',
          fields: { semester: '2026-1', schedule: [] },
          is_container: true,
          children: [
            { title: 'parcial 1', status: 'todo', fields: {}, is_container: false, children: [] },
            { title: 'TP 1',      status: 'todo', fields: {}, is_container: false, children: [] },
          ],
        },
      ],
    },
  ],
};

function resetInsertPillarItem() {
  (insertPillarItem as ReturnType<typeof vi.fn>).mockClear();
  let n = 0;
  (insertPillarItem as ReturnType<typeof vi.fn>).mockImplementation(async () => `item-${++n}`);
}

beforeEach(() => {
  resetDbMock();
  requireUserMock.mockReset();
  requireUserMock.mockResolvedValue(USER);
  resetInsertPillarItem();
});

// ---------- idempotence ----------

describe('materializeOnboarding — idempotence', () => {
  it('returns { ok: true } immediately when onboarding already completed, without DB writes', async () => {
    requireUserMock.mockResolvedValue(USER_COMPLETED);

    const result = await materializeOnboarding(FLAT_STRUCTURE);

    expect(result).toEqual({ ok: true });
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(insertPillarItem).not.toHaveBeenCalled();
  });
});

// ---------- happy path ----------

describe('materializeOnboarding — happy path (flat pillar)', () => {
  it('returns { ok: true } and creates the pillar + marks onboarding complete', async () => {
    queueResult([]);                    // SELECT pillars → not found
    queueResult([{ id: 'pillar-1' }]); // INSERT pillars → created
    queueResult([]);                    // UPDATE users (consumed by awaited chain)

    const result = await materializeOnboarding(FLAT_STRUCTURE);

    expect(result).toEqual({ ok: true });
    expect(db.insert).toHaveBeenCalledTimes(1); // only the pillars insert (items go via mock)
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('calls insertPillarItem for each flat leaf item with is_sample: false', async () => {
    queueResult([]);
    queueResult([{ id: 'pillar-1' }]);
    queueResult([]);

    await materializeOnboarding(FLAT_STRUCTURE);

    const calls = (insertPillarItem as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2); // 2 leaf items
    for (const [params] of calls) {
      expect(params.isSample).toBe(false);
    }
  });

  it('calls insertPillarItem with is_container: false for flat leaf items', async () => {
    queueResult([]);
    queueResult([{ id: 'pillar-1' }]);
    queueResult([]);

    await materializeOnboarding(FLAT_STRUCTURE);

    const calls = (insertPillarItem as ReturnType<typeof vi.fn>).mock.calls;
    for (const [params] of calls) {
      expect(params.isContainer).toBe(false);
    }
  });

  it('uses the existing pillar if already created (find-or-create)', async () => {
    queueResult([{ id: 'existing-pillar' }]); // SELECT pillars → found
    queueResult([]);                            // UPDATE users

    await materializeOnboarding(FLAT_STRUCTURE);

    expect(db.insert).not.toHaveBeenCalled(); // no new pillar insert
  });
});

// ---------- hierarchical: is_container + parent_item_id ----------

describe('materializeOnboarding — hierarchical pillar (uni)', () => {
  it('inserts container with is_container: true and no parentItemId', async () => {
    queueResult([]);                    // SELECT pillars → not found
    queueResult([{ id: 'pillar-u' }]); // INSERT pillars
    queueResult([]);                    // UPDATE users

    await materializeOnboarding(HIERARCHICAL_STRUCTURE);

    const calls = (insertPillarItem as ReturnType<typeof vi.fn>).mock.calls;
    const [containerParams] = calls[0]; // first call is always the container
    expect(containerParams.isContainer).toBe(true);
    expect(containerParams.parentItemId ?? null).toBeNull();
  });

  it('inserts children with is_container: false and parentItemId pointing to the container', async () => {
    queueResult([]);
    queueResult([{ id: 'pillar-u' }]);
    queueResult([]);

    // First insertPillarItem call (container) returns 'item-1'
    await materializeOnboarding(HIERARCHICAL_STRUCTURE);

    const calls = (insertPillarItem as ReturnType<typeof vi.fn>).mock.calls;
    // calls[0] = container, calls[1] and calls[2] = children
    expect(calls).toHaveLength(3); // 1 container + 2 children

    const containerId = 'item-1'; // mock returns 'item-1' for the first call
    for (const [params] of calls.slice(1)) {
      expect(params.isContainer).toBe(false);
      expect(params.parentItemId).toBe(containerId);
      expect(params.isSample).toBe(false);
    }
  });
});

// ---------- error handling ----------

describe('materializeOnboarding — errors', () => {
  it('returns { ok: false, error: plan_limit } when insertPillarItem throws LeafItemLimitError', async () => {
    queueResult([]);
    queueResult([{ id: 'pillar-1' }]);

    (insertPillarItem as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new LeafItemLimitError(150),
    );

    const result = await materializeOnboarding(FLAT_STRUCTURE);

    expect(result).toEqual({ ok: false, error: 'plan_limit' });
    expect(db.update).not.toHaveBeenCalled(); // onboarding NOT marked complete on error
  });

  it('returns { ok: false, error: unknown } for unexpected errors', async () => {
    queueResult([]);
    queueResult([{ id: 'pillar-1' }]);

    (insertPillarItem as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('unexpected DB failure'),
    );

    const result = await materializeOnboarding(FLAT_STRUCTURE);

    expect(result).toEqual({ ok: false, error: 'unknown' });
    expect(db.update).not.toHaveBeenCalled();
  });
});
