'use client';

import { useState, useTransition } from 'react';
import { Shield, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/lib/hooks/useToast';
import { setUserActive, setUserRole, type AdminActionResult } from '@/app/admin/actions';
import type { UserRole, UserPlan, UserPlanStatus } from '@/lib/types';

export type AdminUserRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  plan: UserPlan;
  plan_status: UserPlanStatus;
  active: boolean;
  created_at: string;
  last_login_at: string | null;
};

type Props = {
  users: AdminUserRow[];
  currentUserId: string;
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA'); // YYYY-MM-DD
}

const PLAN_STATUS_VARIANT: Record<UserPlanStatus, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  past_due: 'warning',
  cancelled: 'danger',
};

export function UsersTable({ users, currentUserId }: Props) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<null | { kind: 'deactivate' | 'demote'; user: AdminUserRow }>(null);

  function run(action: Promise<AdminActionResult>, successMsg: string) {
    startTransition(async () => {
      const res = await action;
      if (res.ok) toast.success(successMsg);
      else toast.error(res.error);
    });
  }

  function toggleActive(u: AdminUserRow) {
    if (u.active) {
      setConfirm({ kind: 'deactivate', user: u });
    } else {
      run(setUserActive({ userId: u.id, active: true }), 'usuario reactivado');
    }
  }

  function toggleRole(u: AdminUserRow) {
    if (u.role === 'admin') {
      setConfirm({ kind: 'demote', user: u });
    } else {
      run(setUserRole({ userId: u.id, role: 'admin' }), 'rol actualizado a admin');
    }
  }

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">no hay usuarios.</p>;
  }

  return (
    <>
      <ul className="space-y-2">
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          return (
            <li
              key={u.id}
              className="rounded-lg border border-border bg-surface p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">{u.email}</span>
                  {isSelf && <span className="text-[10px] text-muted-foreground">(vos)</span>}
                </div>
                {u.display_name && (
                  <p className="text-xs text-muted-foreground">{u.display_name}</p>
                )}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant={u.role === 'admin' ? 'accent' : 'muted'}>
                    {u.role === 'admin' ? <Shield size={11} /> : <UserIcon size={11} />}
                    {u.role}
                  </Badge>
                  <Badge variant={u.plan === 'pro' ? 'accent' : 'default'}>{u.plan}</Badge>
                  <Badge variant={PLAN_STATUS_VARIANT[u.plan_status]}>{u.plan_status}</Badge>
                  {u.active ? (
                    <Badge variant="success">activo</Badge>
                  ) : (
                    <Badge variant="danger">inactivo</Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  alta {fmt(u.created_at)} · último login {fmt(u.last_login_at)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isPending || (isSelf && u.role === 'admin')}
                  title={isSelf && u.role === 'admin' ? 'no podés quitarte tu propio rol de admin' : undefined}
                  onClick={() => toggleRole(u)}
                >
                  {u.role === 'admin' ? 'hacer member' : 'hacer admin'}
                </Button>
                <Button
                  variant={u.active ? 'danger' : 'secondary'}
                  size="sm"
                  disabled={isPending || (isSelf && u.active)}
                  title={isSelf && u.active ? 'no podés desactivar tu propia cuenta' : undefined}
                  onClick={() => toggleActive(u)}
                >
                  {u.active ? 'desactivar' : 'reactivar'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={confirm?.kind === 'deactivate'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) run(setUserActive({ userId: confirm.user.id, active: false }), 'usuario desactivado');
        }}
        title="desactivar usuario"
        description={
          confirm
            ? `${confirm.user.email} no podrá iniciar sesión y sus sesiones activas se cerrarán.`
            : undefined
        }
        confirmLabel="desactivar"
        variant="danger"
      />

      <ConfirmDialog
        open={confirm?.kind === 'demote'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) run(setUserRole({ userId: confirm.user.id, role: 'member' }), 'rol actualizado a member');
        }}
        title="quitar rol de admin"
        description={
          confirm ? `${confirm.user.email} dejará de tener acceso al panel de admin.` : undefined
        }
        confirmLabel="hacer member"
        variant="danger"
      />
    </>
  );
}
