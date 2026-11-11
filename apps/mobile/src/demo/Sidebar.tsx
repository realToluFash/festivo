import { type Href, router, useGlobalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import type { Tab } from '../components/TodayCover.tsx';
import { TodaySidebar } from '../components/TodaySidebar.tsx';
import { type Opens, TodayShellProvider, useTodayShell } from '../components/todayShell.ts';
import type { ShownEvent } from '../kit/today.ts';
import { eventHref } from './events/EventsModel.ts';
import { EVENT_OF_KEY } from './events/EventsSample.ts';
import { useCurrentPlace } from './OrgSwitcher.tsx';
import { sideEventsOf } from './sideEvents.ts';
import type { EventKey } from './today.ts';

/** The product's sidebar on the demo's sample, the same on Today, Events, the Calendar and Settings (sc-39340): `?sidebar=` picks its list, and an event in it opens the demo's event page. */
export function DemoSidebar({
  events,
  onTab,
  at = 'Today',
  onPerson,
  org = true,
}: {
  events: readonly ShownEvent[];
  onTab: (tab: Tab) => void;
  at?: Tab;
  onPerson?: (() => void) | undefined;
  org?: boolean;
}) {
  const { sidebar } = useGlobalSearchParams<{ sidebar?: string }>();
  const fresh = useCurrentPlace()?.fresh === true;
  const shell = useTodayShell();
  const opening = useMemo(
    () => ({
      ...shell,
      open: (opens: Opens) => {
        if (opens.to !== 'event') return shell.open(opens);
        const id = opens.id in EVENT_OF_KEY ? EVENT_OF_KEY[opens.id as EventKey] : opens.id;
        router.push(eventHref(id) as Href);
      },
    }),
    [shell],
  );

  return (
    <TodayShellProvider value={opening}>
      <TodaySidebar
        events={sideEventsOf(events, sidebar, fresh)}
        onTab={onTab}
        at={at}
        onPerson={onPerson}
        org={org}
      />
    </TodayShellProvider>
  );
}
