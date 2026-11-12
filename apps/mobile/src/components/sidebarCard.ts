import type { OrganisationEvent } from '@soirely/api-client';

import type { Shown } from '../kit/eventsList.ts';
import { sidebarCardOf } from '../kit/eventTop.ts';
import { useServerNow } from '../kit/serverNow.ts';
import { usePhaseOf } from './Events.tsx';

export interface SidebarCard {
  event: Shown | null;
  now: Date;
}

/** The event as the iPad sidebar's card on every page under it, sunk until the event is read (sc-30413). */
export function useSidebarCard(event: OrganisationEvent | null): SidebarCard {
  const now = useServerNow();
  const phase = usePhaseOf(event, now);

  return { event: sidebarCardOf(event, phase), now };
}
