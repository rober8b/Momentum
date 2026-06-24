// Shared rendering helpers for the generic pillar views (grid, kanban, ...).
// Kept separate so each view component doesn't redefine the same field/badge
// logic. See docs/DYNAMIC_PILLARS.md.
import type { PillarItem } from '@/lib/types';

export type BadgeVariant = 'default' | 'accent' | 'warning' | 'danger' | 'success' | 'muted';
const BADGE_VARIANTS = new Set<string>(['default', 'accent', 'warning', 'danger', 'success', 'muted']);

export function badgeVariant(color: string | undefined): BadgeVariant {
  return color && BADGE_VARIANTS.has(color) ? (color as BadgeVariant) : 'default';
}

// Reads a cardFields entry against the item. Plain keys read typed columns
// (description, status); 'fields.x' keys read the jsonb fields bag.
// See docs/DYNAMIC_PILLARS.md — "config shape per view type".
export function readCardField(item: PillarItem, key: string): string | null {
  if (key.startsWith('fields.')) {
    const value = item.fields[key.slice('fields.'.length)];
    return typeof value === 'string' && value ? value : null;
  }
  if (key === 'description') return item.description;
  if (key === 'due_date') return item.due_date ? `vence: ${item.due_date}` : null;
  if (key === 'status') return null; // status is rendered as the badge, not as text
  return null;
}
