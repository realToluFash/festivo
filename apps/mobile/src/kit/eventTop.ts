import type { OrganisationEvent } from '@soirely/api-client';
import type { EventPhase } from '@soirely/domain';

import type { LayoutKind } from '../layout/classify.ts';
import type { EventPlace } from './eventNav.ts';
import type { Opened } from './eventsOpen.ts';
import { type Shown, listEventOf, shownEvent } from './eventsList.ts';

export interface EventTop {
  /** The event's areas head the page from the moment it opens, and stay over a failed load; a missing event has none. */
  inEvent: boolean;
  /** Overview opens on the event's card, which names the page, its name taking focus once the event loads. */
  cardNamed: boolean;
  /** Upright, the area names itself at the head of its scroll, under the demo's ‹ Events row. */
  areaTitled: boolean;
  /** Who draws ‹ in the frame: the phone's back row, and upright the row it shares with the bell. */
  frameBack: 'area' | 'events' | null;
}

/** An event's page's top as the demo's EventFrame draws it, in every phase, while the event loads and when the load failed (sc-30413, sc-80863). */
export function eventTop(kind: LayoutKind, area: EventPlace, opened: Opened['kind']): EventTop {
  const portrait = kind === 'tabletPortrait';
  const inEvent = opened !== 'notFound';

  // A missing event stands in the Events frame with its own Back to Events, as the demo's deleted event does (sc-1468, sc-80863).
  if (!inEvent) return { inEvent, cardNamed: true, areaTitled: false, frameBack: null };

  return {
    inEvent,
    cardNamed: area === 'overview',
    areaTitled: portrait && area !== 'overview',
    frameBack: kind === 'phone' ? 'area' : portrait ? 'events' : null,
  };
}

/** The iPad sidebar's card: sunk (null) until the event and its phase are read. */
export function sidebarCardOf(
  event: OrganisationEvent | null,
  phase: EventPhase | null,
): Shown | null {
  return event == null || phase == null
    ? null
    : shownEvent(listEventOf({ ...event, milestones: null }), phase);
}
