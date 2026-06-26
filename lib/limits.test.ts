import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => import('../test/stubs/db-mock'));

import { queueResult, resetDbMock } from '../test/stubs/db-mock';
import { checkLimit, isHostedMode } from '@/lib/limits';

const ORIGINAL_MODE = process.env.MOMENTUM_MODE;

describe('checkLimit — leaf_items (total across all pillars)', () => {
  beforeEach(() => {
    resetDbMock();
    process.env.MOMENTUM_MODE = ORIGINAL_MODE;
  });

  it('self-host: always unlimited, never touches the DB', async () => {
    delete process.env.MOMENTUM_MODE;
    const { db } = await import('../test/stubs/db-mock');

    const result = await checkLimit('user-1', 'leaf_items');

    expect(result).toEqual({ allowed: true, current: 0, limit: null });
    expect(db.select).not.toHaveBeenCalled();
  });

  it('hosted + free plan: under the 150 limit is allowed', async () => {
    process.env.MOMENTUM_MODE = 'hosted';
    queueResult([{ plan: 'free' }]); // user plan lookup
    queueResult([{ value: 149 }]);   // countTotalLeafItems

    const result = await checkLimit('user-1', 'leaf_items');

    expect(result).toEqual({ allowed: true, current: 149, limit: 150 });
  });

  it('hosted + free plan: exactly at 150 is NOT allowed', async () => {
    process.env.MOMENTUM_MODE = 'hosted';
    queueResult([{ plan: 'free' }]);
    queueResult([{ value: 150 }]);

    const result = await checkLimit('user-1', 'leaf_items');

    expect(result).toEqual({ allowed: false, current: 150, limit: 150 });
  });

  it('hosted + free plan: over the limit is NOT allowed', async () => {
    process.env.MOMENTUM_MODE = 'hosted';
    queueResult([{ plan: 'free' }]);
    queueResult([{ value: 200 }]);

    const result = await checkLimit('user-1', 'leaf_items');

    expect(result).toEqual({ allowed: false, current: 200, limit: 150 });
  });

  it('hosted + free plan: containers (is_container=true) do not count toward the leaf limit', async () => {
    // The SQL uses WHERE is_container = false — containers are excluded at query time.
    // Simulated as: user has many containers but 0 leaf items → still allowed.
    process.env.MOMENTUM_MODE = 'hosted';
    queueResult([{ plan: 'free' }]);
    queueResult([{ value: 0 }]); // countTotalLeafItems returns 0 (containers excluded by SQL)

    const result = await checkLimit('user-1', 'leaf_items');

    expect(result).toEqual({ allowed: true, current: 0, limit: 150 });
  });

  it('hosted + pro plan: unlimited regardless of leaf item count', async () => {
    process.env.MOMENTUM_MODE = 'hosted';
    queueResult([{ plan: 'pro' }]); // plan lookup; countTotalLeafItems never called

    const result = await checkLimit('user-1', 'leaf_items');

    expect(result).toEqual({ allowed: true, current: 0, limit: null });
  });

  it('hosted + no user row: defaults to free plan limits', async () => {
    process.env.MOMENTUM_MODE = 'hosted';
    queueResult([]); // no user row → defaults to free
    queueResult([{ value: 10 }]);

    const result = await checkLimit('missing-user', 'leaf_items');

    expect(result).toEqual({ allowed: true, current: 10, limit: 150 });
  });
});

describe('checkLimit — api_tokens', () => {
  beforeEach(() => {
    resetDbMock();
    process.env.MOMENTUM_MODE = ORIGINAL_MODE;
  });

  it('self-host: always unlimited for api_tokens too', async () => {
    delete process.env.MOMENTUM_MODE;
    const { db } = await import('../test/stubs/db-mock');

    const result = await checkLimit('user-1', 'api_tokens');

    expect(result).toEqual({ allowed: true, current: 0, limit: null });
    expect(db.select).not.toHaveBeenCalled();
  });

  it('hosted + free plan: at the token limit is NOT allowed', async () => {
    process.env.MOMENTUM_MODE = 'hosted';
    queueResult([{ plan: 'free' }]);
    queueResult([{ value: 1 }]); // 1 active token — at the free limit of 1

    const result = await checkLimit('user-1', 'api_tokens');

    expect(result).toEqual({ allowed: false, current: 1, limit: 1 });
  });

  it('hosted + free plan: zero tokens allows creation', async () => {
    process.env.MOMENTUM_MODE = 'hosted';
    queueResult([{ plan: 'free' }]);
    queueResult([{ value: 0 }]);

    const result = await checkLimit('user-1', 'api_tokens');

    expect(result).toEqual({ allowed: true, current: 0, limit: 1 });
  });
});

describe('isHostedMode', () => {
  beforeEach(() => {
    process.env.MOMENTUM_MODE = ORIGINAL_MODE;
  });

  it('is false when MOMENTUM_MODE is unset', () => {
    delete process.env.MOMENTUM_MODE;
    expect(isHostedMode()).toBe(false);
  });

  it('is false for any non-"hosted" value', () => {
    process.env.MOMENTUM_MODE = 'self_hosted';
    expect(isHostedMode()).toBe(false);
  });

  it('is true when MOMENTUM_MODE=hosted', () => {
    process.env.MOMENTUM_MODE = 'hosted';
    expect(isHostedMode()).toBe(true);
  });
});
