import { Badge } from '@/components/ui/Badge';

export type AuditEntry = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
};

function fmtTs(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', { hour12: false });
}

export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">no hay eventos para los filtros aplicados.</p>;
  }

  return (
    <ul className="space-y-2">
      {entries.map((e) => {
        const hasMeta = e.metadata && Object.keys(e.metadata).length > 0;
        return (
          <li key={e.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <Badge variant="muted">{e.action}</Badge>
                {e.entity_type && (
                  <span className="text-xs text-muted-foreground">
                    {e.entity_type}
                    {e.entity_id ? <span className="font-mono"> · {e.entity_id.slice(0, 8)}</span> : null}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground font-mono shrink-0">{fmtTs(e.created_at)}</span>
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              {e.user_email ?? (e.user_id ? <span className="font-mono">{e.user_id.slice(0, 8)}</span> : 'sistema / usuario eliminado')}
            </div>
            {hasMeta && (
              <pre className="mt-2 overflow-x-auto rounded-md bg-surface-elev p-2 text-[11px] text-muted-foreground font-mono">
                {JSON.stringify(e.metadata)}
              </pre>
            )}
          </li>
        );
      })}
    </ul>
  );
}
