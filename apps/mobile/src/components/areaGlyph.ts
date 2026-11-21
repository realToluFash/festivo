import type { EventArea } from '@soirely/domain';

import type { GlyphName } from './Glyph.tsx';

/** Each area of an event by its glyph, in the sidebar, the tab bar and the More sheet. */
export const AREA_GLYPH: Record<EventArea | 'people', GlyphName> = {
  overview: 'overview',
  guests: 'users',
  menu: 'menu',
  seating: 'seating',
  messages: 'chat',
  schedule: 'clock',
  staff: 'user',
  people: 'people',
  budget: 'wallet',
  reports: 'reports',
};
