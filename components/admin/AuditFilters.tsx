'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';

type Props = {
  actions: string[];
  users: { id: string; email: string }[];
  selectedAction: string;
  selectedUser: string;
};

const selectCls = cn(
  'h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
);

export function AuditFilters({ actions, users, selectedAction, selectedUser }: Props) {
  const router = useRouter();

  // Rebuild the query from the current selections, always resetting to page 1.
  function navigate(next: { action?: string; user?: string }) {
    const action = next.action ?? selectedAction;
    const user = next.user ?? selectedUser;
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    if (user) params.set('user', user);
    const qs = params.toString();
    router.push(qs ? `/admin/audit?${qs}` : '/admin/audit');
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        aria-label="filtrar por acción"
        className={selectCls}
        value={selectedAction}
        onChange={(e) => navigate({ action: e.target.value })}
      >
        <option value="">todas las acciones</option>
        {actions.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      <select
        aria-label="filtrar por usuario"
        className={selectCls}
        value={selectedUser}
        onChange={(e) => navigate({ user: e.target.value })}
      >
        <option value="">todos los usuarios</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.email}</option>
        ))}
      </select>

      {(selectedAction || selectedUser) && (
        <button
          type="button"
          onClick={() => router.push('/admin/audit')}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          limpiar filtros
        </button>
      )}
    </div>
  );
}
