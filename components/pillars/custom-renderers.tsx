// Registry for 'custom' view_type pillars — looked up by
// pillar.config.renderer (a plain string key), per docs/DYNAMIC_PILLARS.md:
// "Exotic views... are 'custom' renderers, registered in code, explicitly
// out of scope for the generic engine." Add an entry here when a new
// pillar needs one; don't try to generalize the renderer itself.
import type { ComponentType } from 'react';
import { UniScheduleRenderer } from '@/components/pillars/UniScheduleRenderer';
import type { Pillar, PillarItem } from '@/lib/types';

export type CustomRendererProps = {
  pillar: Pillar;
  items: PillarItem[];
  basePath?: string;
};

export const CUSTOM_RENDERERS: Record<string, ComponentType<CustomRendererProps>> = {
  'uni-schedule': UniScheduleRenderer,
};
