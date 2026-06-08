import type { DayOfWeek } from './types';

const DAY_MAP: Record<string, DayOfWeek> = {
  Sun: 'sun', Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat',
};

export function todayKey(tz: string): DayOfWeek {
  const short = new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
  return DAY_MAP[short] ?? 'mon';
}

export function todayISO(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

export function inDaysISO(days: number, tz: string): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
}

export function formatDate(iso: string | null, tz: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { timeZone: tz, day: '2-digit', month: 'short' });
}

export function formatFullDate(tz: string): string {
  return new Date().toLocaleDateString('en-US', {
    timeZone: tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function urgencyOf(
  dueDate: string | null,
  tz: string,
): 'overdue' | 'today' | 'soon' | 'later' | 'none' {
  if (!dueDate) return 'none';
  const today = todayISO(tz);
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  if (dueDate <= inDaysISO(7, tz)) return 'soon';
  return 'later';
}
