import type { OrganisationEvent } from '@soirely/api-client';
import type { EventPhase } from '@soirely/domain';

import type { LayoutKind } from '../layout/classify.ts';
import type { EventPlace } from './eventNav.ts';
import type { Opened } from './eventsOpen.ts';
import { type Shown, listEventOf, shownEvent } from './eventsList.ts';

export interface EventTop {
  /** The event's areas head the page from the moment it opens; a failed or missing event has none. */
  inEvent: boolean;
  /** Overview opens on the event's card, which names the page, its name taking focus once the event loads. */
  cardNamed: boolean;
  /** Upright, the area names itself at the head of its scroll, under the demo's ‹ Events row. */
  areaTitled: boolean;
  /** Who draws ‹ in the frame: the phone's back row, and upright the row it shares with the bell. */
  frameBack: 'area' | 'events' | null;
  /** On its side the body draws ‹ only on a failed or missing event: in the event, its sidebar is the way to Overview (sc-67708). */
  bodyBack: boolean;
}

/** An event's page's top as the demo's EventFrame draws it, in every phase and while the event loads (sc-30413). */
export function eventTop(kind: LayoutKind, area: EventPlace, opened: Opened['kind']): EventTop {
  const portrait = kind === 'tabletPortrait';
  const inEvent = opened === 'loaded' || opened === 'loading';
  const landscape = kind === 'tabletLandscape';

  // A missing event stands in the Events frame with its own Back to Events, as the demo's deleted event does (sc-1468, sc-80863).
  if (opened === 'notFound')
    return { inEvent, cardNamed: true, areaTitled: false, frameBack: null, bodyBack: false };

  return {
    inEvent,
    // On its side the frame's title is dropped only when the card takes its place: a failed or missing event has none.
    cardNamed: area === 'overview' && (!landscape || inEvent),
    areaTitled: portrait && area !== 'overview',
    frameBack: kind === 'phone' ? 'area' : portrait ? 'events' : null,
    bodyBack: landscape && !inEvent,
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
