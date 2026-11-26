import type { ListedEvent } from '@soirely/api-client';
import { serverClock, todayView } from '@soirely/domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';

import { api } from './api.ts';
import { dateLocale } from './i18n/index.ts';
import type { ShownEvent } from './kit/today.ts';
import { shownEvent } from './kit/todayMoment.ts';

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
