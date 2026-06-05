import Link from 'next/link';
import type { Subject, ScheduleSlot, DayOfWeek } from '@/lib/types';

const DAYS: { id: DayOfWeek; label: string }[] = [
  { id: 'mon', label: 'lun' },
  { id: 'tue', label: 'mar' },
  { id: 'wed', label: 'mié' },
  { id: 'thu', label: 'jue' },
  { id: 'fri', label: 'vie' },
  { id: 'sat', label: 'sáb' },
];

type SlotInstance = { subject: Subject; slot: ScheduleSlot };

export function ScheduleGrid({ subjects }: { subjects: Subject[] }) {
  const slotsByDay = new Map<DayOfWeek, SlotInstance[]>();
  for (const s of subjects) {
    for (const slot of (s.schedule ?? []) as ScheduleSlot[]) {
      const arr = slotsByDay.get(slot.day) ?? [];
      arr.push({ subject: s, slot });
      arr.sort((a, b) => a.slot.start.localeCompare(b.slot.start));
      slotsByDay.set(slot.day, arr);
    }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {DAYS.map((day) => {
        const items = slotsByDay.get(day.id) ?? [];
        return (
          <div key={day.id} className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
              {day.label}
            </h4>
            <div className="space-y-1.5 min-h-[60px]">
              {items.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">libre</p>
              )}
              {items.map((it, i) => (
                <Link
                  key={`${it.subject.id}-${i}`}
                  href={`/uni/${it.subject.id}`}
                  className="block rounded-md border border-border bg-surface-elev p-2 hover:border-accent transition-colors"
                >
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {it.slot.start}–{it.slot.end}
                  </p>
                  <p className="text-xs font-medium leading-tight mt-0.5">
                    {it.subject.name}
                  </p>
                  {it.slot.room && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{it.slot.room}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
