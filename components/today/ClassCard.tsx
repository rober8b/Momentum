import { Clock, MapPin } from 'lucide-react';
import type { TodayClass } from '@/lib/today';

export function ClassCard({ item }: { item: TodayClass }) {
  return (
    <div className="rounded-md border border-border bg-surface-elev p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{item.subject.name}</p>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock size={12} />
          {item.slot.start}–{item.slot.end}
        </span>
        {item.slot.room && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />
            {item.slot.room}
          </span>
        )}
      </div>
    </div>
  );
}
