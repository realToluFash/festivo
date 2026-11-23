import { useGlobalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SETTINGS_ID, type Tab } from '../components/TodayCover.tsx';
import {
  SidebarColumn,
  SidebarEvents,
  SidebarFoot,
  SidebarHead,
  SidebarPlace,
  SidebarPlaces,
  TodaySidebar,
} from '../components/TodaySidebar.tsx';
import { type Opens, TodayShellProvider, useTodayShell } from '../components/todayShell.ts';
import type { ShownEvent } from '../kit/today.ts';
import { EVENT_OF_KEY } from './events/EventsSample.ts';
import { openEvent } from './events/openEvent.ts';
import { useCurrentPlace } from './OrgSwitcher.tsx';
import { sideEventsOf } from './sideEvents.ts';
import type { EventKey } from './today.ts';

/** The product's sidebar on the demo's sample, the same on Today, Events, the Calendar and Settings (sc-39340): `?sidebar=` picks its list, and an event in it opens the demo's event page. `places` false keeps the pill and lists Today alone, as the product's paused in its only organisation (sc-39471). */
export function DemoSidebar({
  events,
  onTab,
  at = 'Today',
  onPerson,
  org = true,
  places = org,
}: {
  events: readonly ShownEvent[];
  onTab: (tab: Tab) => void;
  at?: Tab;
  onPerson?: (() => void) | undefined;
  org?: boolean;
  places?: boolean;
}) {
  const { t } = useTranslation();
  const { sidebar } = useGlobalSearchParams<{ sidebar?: string }>();
  const fresh = useCurrentPlace()?.fresh === true;
  const shell = useTodayShell();
  const opening = useMemo(
    () => ({
      ...shell,
      open: (opens: Opens) => {
        if (opens.to !== 'event') return shell.open(opens);
        const id = opens.id in EVENT_OF_KEY ? EVENT_OF_KEY[opens.id as EventKey] : opens.id;
        openEvent(id);
      },
    }),
    [shell],
  );

  const shown = sideEventsOf(events, sidebar, fresh);

  if (org && !places)
    return (
      <TodayShellProvider value={opening}>
        <SidebarColumn listing>
          <SidebarHead org />
          <SidebarPlaces>
            <SidebarPlace
              label={t('todayScreen.tab.today')}
              glyph="today"
              on={at === 'Today'}
              onPress={() => onTab('Today')}
              testID={SETTINGS_ID.Today}
            />
          </SidebarPlaces>
          <SidebarEvents events={shown} />
          <SidebarFoot onTab={onTab} at={at} onPerson={onPerson} />
        </SidebarColumn>
      </TodayShellProvider>
    );

  return (
    <TodayShellProvider value={opening}>
      <TodaySidebar events={shown} onTab={onTab} at={at} onPerson={onPerson} org={org} />
    </TodayShellProvider>
  );
}
