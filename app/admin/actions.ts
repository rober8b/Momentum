'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// Every admin server action calls requireAdmin() itself — server actions are
// independent POST endpoints and are NOT protected by the /admin layout guard.

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const setActiveSchema = z.object({
  userId: z.string().uuid(),
  active: z.boolean(),
});

/**
 * Activate or deactivate a user (soft-disable). Deactivating also bumps the
 * target's invalidate_sessions_before so existing sessions die immediately;
 * requireUser() already rejects active=false on the next request, this is
 * belt-and-suspenders.
 *
 * Guard: an admin cannot deactivate their own account.
 */
export async function setUserActive(input: unknown): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const { userId, active } = setActiveSchema.parse(input);

  if (!active && userId === admin.id) {
    return { ok: false, error: 'no podés desactivar tu propia cuenta' };
  }

  const [target] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!target) return { ok: false, error: 'usuario no encontrado' };

  await db
    .update(schema.users)
    .set({
      active,
      // Kill live sessions on deactivate; leave the marker untouched on reactivate.
      ...(active ? {} : { invalidate_sessions_before: Math.floor(Date.now() / 1000) }),
    })
    .where(eq(schema.users.id, userId));

  logAudit({
    userId: admin.id,
    action: active ? 'admin_user_activated' : 'admin_user_deactivated',
    entityType: 'user',
    entityId: userId,
  });

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  return { ok: true };
}

const setRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'member']),
});

/**
 * Change a user's role.
 *
 * Guard: an admin cannot remove their OWN admin role (prevents self-lockout).
 */
export async function setUserRole(input: unknown): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const { userId, role } = setRoleSchema.parse(input);

  if (userId === admin.id && role !== 'admin') {
    return { ok: false, error: 'no podés quitarte tu propio rol de admin' };
  }

  const [target] = await db
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!target) return { ok: false, error: 'usuario no encontrado' };

  if (target.role === role) return { ok: true }; // no-op

  await db.update(schema.users).set({ role }).where(eq(schema.users.id, userId));

  logAudit({
    userId: admin.id,
    action: 'admin_user_role_changed',
    entityType: 'user',
    entityId: userId,
    metadata: { from: target.role, to: role },
  });

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  return { ok: true };
}
