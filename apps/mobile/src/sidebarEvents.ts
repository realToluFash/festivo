import type { ListedEvent } from '@soirely/api-client';
import { serverClock, todayView } from '@soirely/domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';

import { api } from './api.ts';
import { dateLocale } from './i18n/index.ts';
import type { ShownEvent } from './kit/today.ts';
import { shownEvent } from './kit/todayMoment.ts';
import { ROOMS, rowPad } from './layout/sidebarSize.ts';
import { LABEL_LINE } from './layout/textSize.ts';
import { tokens } from './theme/tokens.ts';

const NONE: readonly ShownEvent[] = [];
const lists = new Map<string, readonly ShownEvent[]>();
const listeners = new Set<() => void>();

const keyOf = (accountId: string, organisationId: string) => `${accountId} ${organisationId}`;

/** The events iPad landscape's sidebar lists: Today's cards, in Today's order (sc-39340). */
export function sidebarList(
  loaded: { events: readonly ListedEvent[]; at: Date },
  now: Date,
  reader: { timeZone: string; locale: string },
): readonly ShownEvent[] {
  return todayView(loaded, now, reader).cards.map(({ event }) => shownEvent(event));
}

/** The least the list's region shows before the whole sidebar scrolls instead (sc-39340). */
const LEAST_ROWS = 4;

export function sidebarRow(fontScale: number): number {
  return Math.max(
    tokens.sizeHit,
    ROOMS.event.size * fontScale * LABEL_LINE + 2 * rowPad(fontScale),
  );
}

/** The heading as tall as it was drawn, which at the largest text is two lines, or one line before it has been drawn, and up to four rows under it (sc-39340). */
export function listLeast({
  heading,
  size,
  rows,
  row,
}: {
  heading: number | null;
  size: number;
  rows: number;
  row: number;
}): number {
  return (heading ?? size * LABEL_LINE + 2 * tokens.spaceXs) + Math.min(rows, LEAST_ROWS) * row;
}

/** Today publishes what it loaded, so the frame's sidebar has the list the moment a person leaves Today. */
export function publishSidebarEvents(
  accountId: string,
  organisationId: string,
  loaded: { events: readonly ListedEvent[]; at: Date },
): void {
  const reader = {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: dateLocale(),
  };

  lists.set(keyOf(accountId, organisationId), sidebarList(loaded, serverClock.now(), reader));
  listeners.forEach((listener) => listener());
}

export function listedFor(
  accountId: string | undefined,
  organisationId: string | undefined,
): readonly ShownEvent[] {
  if (accountId == null || organisationId == null) return NONE;

  return lists.get(keyOf(accountId, organisationId)) ?? NONE;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/** The person's events in this organisation, read again each time a framed place comes into focus; a failed read keeps what was listed, and another organisation's list is never shown. */
export function useSidebarEvents(
  accountId: string | undefined,
  organisationId: string | undefined,
): readonly ShownEvent[] {
  useFocusEffect(
    useCallback(() => {
      if (accountId == null || organisationId == null) return;

      void api.allEvents(organisationId).then(
        (events) =>
          publishSidebarEvents(accountId, organisationId, { events, at: serverClock.now() }),
        () => undefined,
      );
    }, [accountId, organisationId]),
  );

  return useSyncExternalStore(subscribe, () => listedFor(accountId, organisationId));
}
