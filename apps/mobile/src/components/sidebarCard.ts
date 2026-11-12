import type { OrganisationEvent } from '@soirely/api-client';
import { useEffect, useState } from 'react';

import { api } from '../api.ts';
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

/** The event read for a page under it that loads something else, as All dates loads its milestones. */
export function useEventRead(eventId: string): OrganisationEvent | null {
  const [read, setRead] = useState<{ id: string; event: OrganisationEvent } | null>(null);

  useEffect(() => {
    let live = true;
    api.event(eventId).then(
      (event) => live && setRead({ id: eventId, event }),
      () => {},
    );

    return () => {
      live = false;
    };
  }, [eventId]);

  return read?.id === eventId ? read.event : null;
}
