import type { EventRole } from '@soirely/api-client';
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

const READING_AREAS: readonly SideArea[] = ['overview', 'guests', 'schedule', 'seating', 'people'];

/** What a level held from outside an organisation opens (sc-71): the reading levels the event's own screens, Can edit every area but Budget. */
export function outsideAreas(role: EventRole): readonly SideArea[] {
  return role === 'can_edit' ? SIDE_AREAS.filter((area) => area !== 'budget') : READING_AREAS;
}
