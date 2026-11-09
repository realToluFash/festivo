import type { Account, ListedEvent, Membership } from '@soirely/api-client';
import { roleHolds, roleName, serverClock } from '@soirely/domain';
import { router } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View, type ViewInstance } from 'react-native';

import { api } from '../api.ts';
import type { Tab } from './TodayCover.tsx';
import { TodayScreen } from './TodayScreen.tsx';
import { type Opens, type TodayShell, TodayShellProvider } from './todayShell.ts';
import { dateLocale } from '../i18n/index.ts';
import { DESTINATION_HREF, SECTION_HREF } from '../kit/appNav.ts';
import { todayMoment } from '../kit/todayMoment.ts';
import { SKELETON_AFTER_MS } from '../kit/skeleton.ts';
import { useLayout } from '../layout/useLayout.ts';
import { useUnread } from '../notificationsUnread.ts';
import { type ScreenOffline, useHandOffline, useOffline } from '../offline.ts';
import { afterFailedLoad } from '../offlineLoad.ts';
import { tokens } from '../theme/tokens.ts';
import { useOpenSwitcher } from './AppFrame.tsx';
import { EventsFailed } from './Events.tsx';
import { Pending } from './Pending.tsx';
import { Refreshing } from './Refreshing.tsx';
import { useCoverStatusBar } from './Welcome.tsx';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'loaded'; events: readonly ListedEvent[]; at: Date };

const TAB_HREF = {
  Events: DESTINATION_HREF.events,
  Calendar: DESTINATION_HREF.calendar,
  Settings: DESTINATION_HREF.settings,
} as const;

/** Where signing in lands, for a role that can read events (sc-29090): Today, from the organisation's events. */
export function TodayLanding({
  account,
  organisation,
  notices,
  onOffline,
}: {
  account: Account;
  organisation: Membership;
  notices: ReactNode;
  onOffline: (offline: ScreenOffline) => void;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const unread = useUnread();
  const openSwitcher = useOpenSwitcher();
  const switchFrom = useRef<ViewInstance>(null);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((n) => n + 1), []);
  const { watch, stale, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload,
    focusTitle: () => undefined,
  });

  useHandOffline(onOffline, { stale, refreshing });
  useCoverStatusBar(kind === 'tabletLandscape' ? 'dark' : 'light', false);

  // The greeting and the week are the hour's and the day's, so coming back to the app reads them again.
  useEffect(() => {
    const foreground = AppState.addEventListener('change', (now) => {
      if (now === 'active') reload();
    });

    return () => foreground.remove();
  }, [reload]);

  useEffect(() => {
    let live = true;

    watch(api.allEvents(organisation.id)).then(
      (events) => live && setLoad({ kind: 'loaded', events, at: serverClock.now() }),
      (error: unknown) => live && setLoad((was) => afterFailedLoad(was, error, { kind: 'failed' })),
    );

    return () => {
      live = false;
    };
  }, [organisation.id, attempt, refresh, watch]);

  const open = useCallback(
    (opens: Opens) => {
      switch (opens.to) {
        case 'event':
          router.push(`/events/${opens.id}`);
          return;
        case 'calendar':
        case 'events':
          router.navigate(DESTINATION_HREF[opens.to]);
          return;
        case 'create':
          router.push('/events/new');
          return;
        case 'notifications':
          router.push('/notifications');
          return;
        case 'account':
          router.navigate(SECTION_HREF.account);
          return;
        case 'organisation':
          openSwitcher?.(switchFrom);
          return;
        case 'search':
          return;
      }
    },
    [openSwitcher],
  );
  const shell = useMemo<TodayShell>(
    () => ({
      organisation: organisation.name,
      person: { name: account.name, role: roleName(t, organisation.role) },
      unread,
      creates: roleHolds(organisation, 'events.create'),
      search: false,
      open,
    }),
    [account.name, organisation, unread, open, t],
  );
  const onTab = useCallback((tab: Tab) => {
    if (tab !== 'Today') router.navigate(TAB_HREF[tab]);
  }, []);

  if (load.kind !== 'loaded')
    return (
      <View style={styles.waiting}>
        {load.kind === 'loading' ? (
          <Pending after={SKELETON_AFTER_MS} stacked />
        ) : (
          <EventsFailed
            onRetry={() => {
              setLoad({ kind: 'loading' });
              setAttempt((n) => n + 1);
            }}
            testID="today.retry"
          />
        )}
      </View>
    );

  const moment = todayMoment(
    load,
    serverClock.now(),
    { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale: dateLocale() },
    account.name.split(' ')[0] ?? '',
    t,
  );

  return (
    <TodayShellProvider value={shell}>
      <TodayScreen
        moment={moment}
        onTab={onTab}
        notices={
          <>
            {refreshing && <Refreshing testID="today.refreshing" />}
            {notices}
          </>
        }
      />
    </TodayShellProvider>
  );
}

const styles = StyleSheet.create({
  waiting: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spaceXl,
    backgroundColor: tokens.colorPage,
  },
});
