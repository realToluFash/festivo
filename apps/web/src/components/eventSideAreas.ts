import { EVENT_AREAS, type EventArea } from '@soirely/domain';

import type { GlyphName } from './Glyph.tsx';

/** An event's sidebar entry: the areas both clients share, and the web's People (sc-29915). */
export type SideArea = EventArea | 'people';

/** People comes after Staff, as the event's sidebar demo orders it. */
export const SIDE_AREAS: readonly SideArea[] = [
  ...EVENT_AREAS.slice(0, EVENT_AREAS.indexOf('staff') + 1),
  'people',
  ...EVENT_AREAS.slice(EVENT_AREAS.indexOf('staff') + 1),
];

export const SIDE_AREA_GLYPHS: Record<SideArea, GlyphName> = {
  overview: 'overview',
  guests: 'users',
  menu: 'menu',
  seating: 'seating',
  messages: 'messages',
  schedule: 'clock',
  staff: 'staff',
  people: 'people',
  budget: 'budget',
  reports: 'reports',
};
