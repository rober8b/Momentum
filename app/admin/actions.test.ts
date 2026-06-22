import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => import('../../test/stubs/db-mock'));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }));

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock('@/lib/auth', () => ({ requireAdmin: requireAdminMock }));

import { db, queueResult, resetDbMock } from '../../test/stubs/db-mock';
import { setUserActive, setUserRole } from './actions';

const ADMIN = { id: '11111111-1111-4111-8111-111111111111', role: 'admin' as const };
const USER_2 = '22222222-2222-4222-8222-222222222222';
const GHOST_USER = '99999999-9999-4999-8999-999999999999';

describe('setUserActive — admin guard', () => {
  beforeEach(() => {
    resetDbMock();
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue(ADMIN);
  });

  it('blocks an admin from deactivating their own account, without touching the DB', async () => {
    const result = await setUserActive({ userId: ADMIN.id, active: false });

    expect(result).toEqual({ ok: false, error: 'no podés desactivar tu propia cuenta' });
    expect(db.select).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('allows an admin to reactivate their own account (only deactivation is blocked)', async () => {
    queueResult([{ id: ADMIN.id }]); // target lookup
    const result = await setUserActive({ userId: ADMIN.id, active: true });

    expect(result).toEqual({ ok: true });
    expect(db.update).toHaveBeenCalled();
  });

  it('deactivates a different user successfully', async () => {
    queueResult([{ id: USER_2 }]); // target lookup finds the user

    const result = await setUserActive({ userId: USER_2, active: false });

    expect(result).toEqual({ ok: true });
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('returns an error when the target user does not exist', async () => {
    queueResult([]); // no target found

    const result = await setUserActive({ userId: GHOST_USER, active: false });

    expect(result).toEqual({ ok: false, error: 'usuario no encontrado' });
    expect(db.update).not.toHaveBeenCalled();
  });

  it('rejects a non-admin caller before doing anything (requireAdmin throws)', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('NOT_SIGNED_IN'));

    await expect(setUserActive({ userId: USER_2, active: false })).rejects.toThrow('NOT_SIGNED_IN');
    expect(db.select).not.toHaveBeenCalled();
  });
});

describe('setUserRole — self-lockout guard', () => {
  beforeEach(() => {
    resetDbMock();
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue(ADMIN);
  });

  it('blocks an admin from demoting their own account, without touching the DB', async () => {
    const result = await setUserRole({ userId: ADMIN.id, role: 'member' });

    expect(result).toEqual({ ok: false, error: 'no podés quitarte tu propio rol de admin' });
    expect(db.select).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('allows an admin to re-affirm their own admin role (no-op path, not blocked)', async () => {
    queueResult([{ id: ADMIN.id, role: 'admin' }]); // target lookup: already admin

    const result = await setUserRole({ userId: ADMIN.id, role: 'admin' });

    expect(result).toEqual({ ok: true });
    expect(db.update).not.toHaveBeenCalled(); // no-op since role unchanged
  });

  it('promotes a different user to admin', async () => {
    queueResult([{ id: USER_2, role: 'member' }]);

    const result = await setUserRole({ userId: USER_2, role: 'admin' });

    expect(result).toEqual({ ok: true });
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the target already has the requested role', async () => {
    queueResult([{ id: USER_2, role: 'member' }]);

    const result = await setUserRole({ userId: USER_2, role: 'member' });

    expect(result).toEqual({ ok: true });
    expect(db.update).not.toHaveBeenCalled();
  });

  it('returns an error when the target user does not exist', async () => {
    queueResult([]);

    const result = await setUserRole({ userId: GHOST_USER, role: 'admin' });

    expect(result).toEqual({ ok: false, error: 'usuario no encontrado' });
  });
});
