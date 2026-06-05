import type { DayOfWeek } from './types';

const DAY_INDEX: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function todayKey(): DayOfWeek {
  return DAY_INDEX[new Date().getDay()];
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function inDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export function formatFullDate(): string {
  return new Date().toLocaleDateString('es-AR', {
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
