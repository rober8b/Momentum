import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => import('../test/stubs/db-mock'));

import { queueResult, resetDbMock } from '../test/stubs/db-mock';
import { checkLimit, isHostedMode } from '@/lib/limits';

const ORIGINAL_MODE = process.env.MOMENTUM_MODE;

describe('checkLimit', () => {
  beforeEach(() => {
    resetDbMock();
    process.env.MOMENTUM_MODE = ORIGINAL_MODE;
  });

  it('self-host: always unlimited, never touches the DB', async () => {
    delete process.env.MOMENTUM_MODE;
    const { db } = await import('../test/stubs/db-mock');

    const result = await checkLimit('user-1', 'workblocks');

    expect(result).toEqual({ allowed: true, current: 0, limit: null });
    expect(db.select).not.toHaveBeenCalled();
  });

  it('hosted + free plan: under limit is allowed', async () => {
    process.env.MOMENTUM_MODE = 'hosted';
    queueResult([{ plan: 'free' }]); // user.plan lookup
    queueResult([{ value: 49 }]); // countResource — free.workblocks limit is 50

    const result = await checkLimit('user-1', 'workblocks');

    expect(result).toEqual({ allowed: true, current: 49, limit: 50 });
  });

  it('hosted + free plan: at the limit is NOT allowed', async () => {
    process.env.MOMENTUM_MODE = 'hosted';
    queueResult([{ plan: 'free' }]);
    queueResult([{ value: 50 }]);

    const result = await checkLimit('user-1', 'workblocks');

    expect(result).toEqual({ allowed: false, current: 50, limit: 50 });
  });

  it('hosted + free plan: over the limit is NOT allowed', async () => {
    process.env.MOMENTUM_MODE = 'hosted';
    queueResult([{ plan: 'free' }]);
    queueResult([{ value: 75 }]);

    const result = await checkLimit('user-1', 'workblocks');

    expect(result).toEqual({ allowed: false, current: 75, limit: 50 });
  });

  it('hosted + pro plan: unlimited regardless of usage', async () => {
    process.env.MOMENTUM_MODE = 'hosted';
    queueResult([{ plan: 'pro' }]); // user.plan lookup; countResource is never reached

    const result = await checkLimit('user-1', 'workblocks');

    expect(result).toEqual({ allowed: true, current: 0, limit: null });
  });

  it('hosted + no user row found: defaults to free plan limits', async () => {
    process.env.MOMENTUM_MODE = 'hosted';
    queueResult([]); // no user row
    queueResult([{ value: 10 }]);

    const result = await checkLimit('missing-user', 'workblocks');

    expect(result).toEqual({ allowed: true, current: 10, limit: 50 });
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
