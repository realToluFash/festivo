import { isPlaceholderEventArea } from '@soirely/domain';
import { useCallback, useEffect, useState } from 'react';
import { matchPath } from 'react-router';

import { api } from '../../../api.ts';
import type { SideArea } from '../../../components/eventSideAreas.ts';
import { PHONE_WIDTH, usePhoneWidth } from '../../../phoneWidth.ts';
import { canOn } from '../../../session.ts';

export type HandoffPage =
  { kind: 'new' } | { kind: 'event'; eventId: string; area: SideArea | null; needs: string | null };

export type Handoff =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'shown'; page: HandoffPage; name: string | null };

const AREA_NEEDS: Partial<Record<SideArea, string>> = {
  guests: 'guests.read',
  seating: 'seating.read',
  schedule: 'run_of_show.read',
  staff: 'staff.read',
};

/** The pages main has under `/app/events`, and what each needs that EventView checks before it shows one. */
export function handoffPage(pathname: string): HandoffPage | null {
  if (matchPath('/app/events/new', pathname) != null) return { kind: 'new' };

  const page = matchPath('/app/events/:eventId', pathname)?.params.eventId;
  if (page != null) return { kind: 'event', eventId: page, area: 'overview', needs: null };

  const roster = matchPath('/app/events/:eventId/staff/roster', pathname)?.params.eventId;
  if (roster != null)
    return { kind: 'event', eventId: roster, area: 'staff', needs: AREA_NEEDS.staff ?? null };

  const part = matchPath('/app/events/:eventId/:part', pathname)?.params;
  const eventId = part?.eventId;
  const name = part?.part ?? '';

  if (eventId == null) return null;
  if (name === 'edit' || name === 'dates')
    return { kind: 'event', eventId, area: 'overview', needs: null };
  if (name === 'run') return { kind: 'event', eventId, area: null, needs: 'run_of_show.read' };
  if (name === 'guests' || name === 'people' || isPlaceholderEventArea(name))
    return { kind: 'event', eventId, area: name, needs: AREA_NEEDS[name] ?? null };

  return null;
}

const ANYWAY = 'soirely.showPageAnyway';
let anywayHere = false;

/** Show this page anyway lasts for the tab, reloads included, and not for a new tab. */
function shownAnyway(): boolean {
  try {
    return anywayHere || window.sessionStorage.getItem(ANYWAY) === '1';
  } catch {
    return anywayHere;
  }
}

function rememberAnyway(): void {
  anywayHere = true;
  try {
    window.sessionStorage.setItem(ANYWAY, '1');
  } catch {
    // Without storage it lasts until the page reloads.
  }
}

function phoneNow(): boolean {
  return window.matchMedia(PHONE_WIDTH).matches;
}

type Read =
  | { key: string; kind: 'loading' }
  | { key: string; kind: 'read'; name: string; permissions: readonly string[] }
  | { key: string; kind: 'refused' };

/** The width is read when a page opens: narrowing an open page keeps it, and widening replaces the handoff for good. */
export function useHandoff(
  pathname: string,
  organisationId: string | null,
  enabled: boolean,
): { handoff: Handoff; showAnyway: () => void } {
  const narrow = usePhoneWidth();
  const [opened, setOpened] = useState(() => ({ pathname, narrow: phoneNow() }));
  const [anyway, setAnyway] = useState(shownAnyway);
  const page = handoffPage(pathname);
  const eventId = page?.kind === 'event' ? page.eventId : null;
  const key = `${organisationId ?? ''}:${eventId ?? ''}`;
  const [read, setRead] = useState<Read | null>(null);

  if (opened.pathname !== pathname) setOpened({ pathname, narrow: phoneNow() });
  else if (opened.narrow && !narrow) setOpened({ pathname, narrow: false });

  const wanted = enabled && page != null && opened.narrow && narrow && !anyway;
  const reads = wanted && eventId != null && organisationId != null;

  useEffect(() => {
    if (!reads || eventId == null) return;
    let current = true;

    api.taggedEvent(eventId).then(
      ({ event }) =>
        current &&
        setRead(
          event.organisationId === organisationId
            ? { key, kind: 'read', name: event.name, permissions: event.permissions }
            : { key, kind: 'refused' },
        ),
      // Not there, not theirs, or not loaded: the page itself says which, as on main.
      () => current && setRead({ key, kind: 'refused' }),
    );

    return () => {
      current = false;
    };
  }, [reads, eventId, organisationId, key]);

  const showAnyway = useCallback(() => {
    rememberAnyway();
    setAnyway(true);
  }, []);

  if (!wanted || page == null) return { handoff: { kind: 'none' }, showAnyway };
  if (page.kind === 'new') return { handoff: { kind: 'shown', page, name: null }, showAnyway };
  if (organisationId == null) return { handoff: { kind: 'none' }, showAnyway };
  if (read == null || read.key !== key || read.kind === 'loading')
    return { handoff: { kind: 'loading' }, showAnyway };
  if (read.kind === 'refused') return { handoff: { kind: 'none' }, showAnyway };
  if (page.needs != null && !canOn(read, page.needs))
    return { handoff: { kind: 'none' }, showAnyway };

  return { handoff: { kind: 'shown', page, name: read.name }, showAnyway };
}
