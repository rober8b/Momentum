import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { GraduationCap } from 'lucide-react';
import { badgeVariant } from '@/components/pillars/pillar-render-utils';
import type { DayOfWeek, Pillar, PillarItem, ScheduleSlot } from '@/lib/types';

const DAYS: { id: DayOfWeek; label: string }[] = [
  { id: 'mon', label: 'lun' },
  { id: 'tue', label: 'mar' },
  { id: 'wed', label: 'mié' },
  { id: 'thu', label: 'jue' },
  { id: 'fri', label: 'vie' },
  { id: 'sat', label: 'sáb' },
];

type SlotInstance = { subject: PillarItem; slot: ScheduleSlot };

function readSchedule(item: PillarItem): ScheduleSlot[] {
  const raw = item.fields.schedule;
  return Array.isArray(raw) ? (raw as ScheduleSlot[]) : [];
}

// The Uni weekly schedule — a registered 'custom' renderer
// (config.renderer: 'uni-schedule'), per docs/DYNAMIC_PILLARS.md: this view
// is exotic enough (a day x time grid, not a list/kanban/grid of cards) that
// generalizing it into the generic engine would be the over-engineering
// trap. It reads fields.schedule straight off each subject container item —
// the schedule lives on the PARENT, not on a child. `items` here are the
// pillar's top-level (container) items, same contract as GenericGrid for
// hierarchy-required pillars.
export function UniScheduleRenderer({
  items,
  basePath,
}: {
  pillar: Pillar;
  items: PillarItem[];
  basePath?: string;
}) {
  const resolvedBasePath = basePath ?? '/uni';

  if (items.length === 0) {
    return <EmptyState icon={GraduationCap} title="sin materias todavía" description="agregá la primera con el formulario de arriba." />;
  }

  const slotsByDay = new Map<DayOfWeek, SlotInstance[]>();
  for (const subject of items) {
    for (const slot of readSchedule(subject)) {
      const arr = slotsByDay.get(slot.day) ?? [];
      arr.push({ subject, slot });
      arr.sort((a, b) => a.slot.start.localeCompare(b.slot.start));
      slotsByDay.set(slot.day, arr);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {DAYS.map((day) => {
          const slots = slotsByDay.get(day.id) ?? [];
          return (
            <div key={day.id} className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-mono">{day.label}</h4>
              <div className="space-y-1.5 min-h-[60px]">
                {slots.length === 0 && <p className="text-[10px] text-muted-foreground italic">libre</p>}
                {slots.map((it, i) => (
                  <Link
                    key={`${it.subject.id}-${i}`}
                    href={`${resolvedBasePath}/${it.subject.id}`}
                    className="block rounded-md border border-border bg-surface-elev p-2 hover:border-accent transition-colors"
                  >
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {it.slot.start}–{it.slot.end}
                    </p>
                    <p className="text-xs font-medium leading-tight mt-0.5">{it.subject.title}</p>
                    {it.slot.room && <p className="text-[10px] text-muted-foreground mt-0.5">{it.slot.room}</p>}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((subject) => {
          const step = subject.status === 'active'
            ? { label: 'activa', color: 'accent' }
            : { label: 'inactiva', color: 'muted' };
          return (
            <Link
              key={subject.id}
              href={`${resolvedBasePath}/${subject.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-elev px-2.5 py-1.5 text-xs hover:border-accent transition-colors"
            >
              <Badge variant={badgeVariant(step.color)}>{step.label}</Badge>
              {subject.title}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
