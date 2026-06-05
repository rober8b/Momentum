'use client';

import { useState, useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { updateSubjectSchedule } from '@/app/uni/actions';
import { cn } from '@/lib/cn';
import type { ScheduleSlot, DayOfWeek } from '@/lib/types';

const DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function ScheduleEditor({
  subjectId,
  currentSchedule,
}: {
  subjectId: string;
  currentSchedule: ScheduleSlot[];
}) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<ScheduleSlot[]>(currentSchedule);
  const [isPending, startTransition] = useTransition();

  function addSlot() {
    setSlots([...slots, { day: 'mon', start: '18:00', end: '19:30' }]);
  }
  function removeSlot(i: number) {
    setSlots(slots.filter((_, idx) => idx !== i));
  }
  function update(i: number, patch: Partial<ScheduleSlot>) {
    setSlots(slots.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function save() {
    startTransition(async () => {
      await updateSubjectSchedule(subjectId, slots);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-accent hover:underline"
      >
        editar horarios
      </button>
    );
  }

  return (
    <div className="space-y-3 mt-2">
      {slots.map((slot, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-surface-elev p-2">
          <select
            value={slot.day}
            onChange={(e) => update(i, { day: e.target.value as DayOfWeek })}
            className="rounded-sm border border-border bg-surface px-2 py-1 text-xs"
          >
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input
            type="time"
            value={slot.start}
            onChange={(e) => update(i, { start: e.target.value })}
            className="rounded-sm border border-border bg-surface px-2 py-1 text-xs"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <input
            type="time"
            value={slot.end}
            onChange={(e) => update(i, { end: e.target.value })}
            className="rounded-sm border border-border bg-surface px-2 py-1 text-xs"
          />
          <input
            type="text"
            placeholder="aula"
            value={slot.room ?? ''}
            onChange={(e) => update(i, { room: e.target.value })}
            className={cn('rounded-sm border border-border bg-surface px-2 py-1 text-xs w-20 placeholder:text-muted-foreground')}
          />
          <button
            type="button"
            onClick={() => removeSlot(i)}
            className="ml-auto text-muted-foreground hover:text-danger"
            aria-label="Remove"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addSlot}
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          <Plus size={12} /> agregar slot
        </button>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => { setSlots(currentSchedule); setOpen(false); }}>
            cancel
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={isPending}>
            guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
