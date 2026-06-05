import type { DayOfWeek } from './types';

const TZ = 'America/Argentina/Buenos_Aires';
const DAY_MAP: Record<string, DayOfWeek> = {
  Sun: 'sun', Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat',
};

export function todayKey(): DayOfWeek {
  const short = new Date().toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' });
  return DAY_MAP[short] ?? 'mon';
}

export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function inDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export function formatFullDate(): string {
  return new Date().toLocaleDateString('es-AR', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function urgencyOf(dueDate: string | null): 'overdue' | 'today' | 'soon' | 'later' | 'none' {
  if (!dueDate) return 'none';
  const today = todayISO();
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  if (dueDate <= inDaysISO(7)) return 'soon';
  return 'later';
}
