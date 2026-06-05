import { BlockCard } from './BlockCard';
import { BlockForm } from './BlockForm';
import type { Workblock, WorkblockStatus } from '@/lib/types';

const COLUMNS: { id: WorkblockStatus; label: string; tone: string }[] = [
  { id: 'backlog', label: 'backlog', tone: 'text-muted-foreground' },
  { id: 'today', label: 'hoy', tone: 'text-foreground' },
  { id: 'in-progress', label: 'in progress', tone: 'text-accent' },
  { id: 'blocked', label: 'blocked', tone: 'text-warning' },
  { id: 'done', label: 'done', tone: 'text-success' },
];

export function KanbanBoard({ workblocks }: { workblocks: Workblock[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
      {COLUMNS.map((col) => {
        const items = workblocks.filter((w) => w.status === col.id);
        return (
          <div key={col.id} className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center justify-between gap-2 px-1">
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${col.tone}`}>
                {col.label}
              </h3>
              <span className="text-xs text-muted-foreground font-mono">
                {items.length}
              </span>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {items.map((w) => (
                <BlockCard key={w.id} workblock={w} />
              ))}
              <BlockForm defaultStatus={col.id} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
