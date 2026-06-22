import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => import('../test/stubs/db-mock'));

const { cookiesGet, redirectMock } = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookiesGet })),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import { queueResult, resetDbMock } from '../test/stubs/db-mock';
import { signSession, verifySession, requireUser, requireAdmin, COOKIE_NAME } from '@/lib/auth';

const SECRET = 'test-session-secret-at-least-16-chars';

function baseUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'rober@example.com',
    display_name: null,
    role: 'member',
    active: true,
    plan: 'free',
    plan_status: 'active',
    settings: {},
    invalidate_sessions_before: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    last_login_at: null,
    ...overrides,
  };
}

describe('signSession / verifySession (HMAC)', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = SECRET;
  });

  it('round-trips a valid token', () => {
    const token = signSession('user-1');
    const result = verifySession(token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('user-1');
    expect(typeof result!.iat).toBe('number');
  });

  it('rejects a tampered signature', () => {
    const token = signSession('user-1');
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(verifySession(tampered)).toBeNull();
  });

  it('rejects a tampered payload (userId swapped) even with the original signature', () => {
    const token = signSession('user-1');
    const [, iat, sig] = token.split('.');
    const forged = `attacker-id.${iat}.${sig}`;
    expect(verifySession(forged)).toBeNull();
  });

  it('rejects malformed tokens (missing segments)', () => {
    expect(verifySession('not-a-valid-token')).toBeNull();
    expect(verifySession('')).toBeNull();
    expect(verifySession(undefined)).toBeNull();
  });

  it('rejects a token signed under a different secret', () => {
    const token = signSession('user-1');
    process.env.SESSION_SECRET = 'a-completely-different-secret-16+';
    expect(verifySession(token)).toBeNull();
  });
});

describe('requireUser', () => {
  beforeEach(() => {
    resetDbMock();
    cookiesGet.mockReset();
    process.env.SESSION_SECRET = SECRET;
  });

  it('throws NOT_SIGNED_IN when there is no cookie', async () => {
    cookiesGet.mockReturnValue(undefined);
    await expect(requireUser()).rejects.toThrow('NOT_SIGNED_IN');
  });

  it('throws NOT_SIGNED_IN when the cookie signature is invalid', async () => {
    cookiesGet.mockReturnValue({ value: 'garbage.123.notavalidsig' });
    await expect(requireUser()).rejects.toThrow('NOT_SIGNED_IN');
  });

  it('returns the user for a valid cookie + active user', async () => {
    const token = signSession('user-1');
    cookiesGet.mockReturnValue({ value: token });
    queueResult([baseUserRow({ active: true })]);

    const user = await requireUser();

    expect(user.id).toBe('user-1');
    expect(user.settings).toMatchObject({ language: expect.any(String) });
  });

  it('rejects an inactive (deactivated) user even with a valid signed cookie', async () => {
    const token = signSession('user-1');
    cookiesGet.mockReturnValue({ value: token });
    queueResult([baseUserRow({ active: false })]);

    await expect(requireUser()).rejects.toThrow('NOT_SIGNED_IN');
  });

  it('rejects a session issued before invalidate_sessions_before', async () => {
    const token = signSession('user-1');
    const { iat } = verifySession(token)!;
    cookiesGet.mockReturnValue({ value: token });
    queueResult([baseUserRow({ active: true, invalidate_sessions_before: iat + 1000 })]);

    await expect(requireUser()).rejects.toThrow('NOT_SIGNED_IN');
  });

  it('allows a session issued after invalidate_sessions_before', async () => {
    const token = signSession('user-1');
    const { iat } = verifySession(token)!;
    cookiesGet.mockReturnValue({ value: token });
    queueResult([baseUserRow({ active: true, invalidate_sessions_before: iat - 1000 })]);

    const user = await requireUser();
    expect(user.id).toBe('user-1');
  });

  it('rejects when the user row no longer exists', async () => {
    const token = signSession('user-1');
    cookiesGet.mockReturnValue({ value: token });
    queueResult([]); // no row

    await expect(requireUser()).rejects.toThrow('NOT_SIGNED_IN');
  });
});

describe('requireAdmin', () => {
  beforeEach(() => {
    resetDbMock();
    cookiesGet.mockReset();
    redirectMock.mockClear();
    process.env.SESSION_SECRET = SECRET;
  });

  it('rejects (redirects) a member', async () => {
    const token = signSession('user-1');
    cookiesGet.mockReturnValue({ value: token });
    queueResult([baseUserRow({ role: 'member', active: true })]);

    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/');
    expect(redirectMock).toHaveBeenCalledWith('/');
  });

  it('allows an admin through without redirecting', async () => {
    const token = signSession('user-1');
    cookiesGet.mockReturnValue({ value: token });
    queueResult([baseUserRow({ role: 'admin', active: true })]);

    const user = await requireAdmin();

    expect(user.role).toBe('admin');
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('still rejects an unauthenticated request before checking role', async () => {
    cookiesGet.mockReturnValue(undefined);
    await expect(requireAdmin()).rejects.toThrow('NOT_SIGNED_IN');
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe('COOKIE_NAME', () => {
  it('is a stable, non-empty cookie name', () => {
    expect(COOKIE_NAME).toBe('momentum_session');
  });
});
