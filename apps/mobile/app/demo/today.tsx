import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toast } from '../../src/components/Toast.tsx';
import { useSystemBack } from '../../src/components/useSystemBack.ts';
import { useLayout } from '../../src/layout/useLayout.ts';
import { createStateOf } from '../../src/demo/createOrg/CreateWalk.ts';
import { NoOrganisation } from '../../src/demo/createOrg/NoOrganisation.tsx';
import { OrgSwitcherProvider, useCurrentPlace } from '../../src/demo/OrgSwitcher.tsx';
import { switcherStateOf } from '../../src/demo/OrgSwitcherModel.ts';
import { INVITES_NOT_SENT, MOMENTS, momentOf, sayIn } from '../../src/demo/today.ts';
import { ArrivedTodayScreen } from '../../src/demo/today/ArrivedToday.tsx';
import {
  ARRIVED_AT,
  type ArrivedState,
  type Counts,
  COUNTS,
  figureOf,
  isArrivedState,
  LIVE,
  withArrived,
} from '../../src/demo/today/arrived.ts';
import { RunTodayScreen } from '../../src/demo/today/RunToday.tsx';
import { isRunState, withRun } from '../../src/demo/today/runOfShow.ts';
import type { MomentName } from '../../src/kit/today.ts';
import type { Tab } from '../../src/components/TodayCover.tsx';
import type { Tell } from '../../src/components/TodayParts.tsx';
import { TAB_BAR, TodayScreen } from '../../src/components/TodayScreen.tsx';
import { TodayShellProvider } from '../../src/components/todayShell.ts';
import { demoShell } from '../../src/demo/demoShell.ts';
import { openEvent } from '../../src/demo/events/EventsList.tsx';
import { EVENT_OF_KEY } from '../../src/demo/events/EventsSample.ts';
import { useCoverStatusBar } from '../../src/demo/Welcome.tsx';
import { tokens } from '../../src/theme/tokens.ts';
import { SwitchedNotice } from '../../src/components/SwitchedNotice.tsx';

function toEvents() {
  router.replace('/demo/events');
}

function toCalendar() {
  router.replace('/demo/calendar');
}

/** The demo's numbers, in the phone's own region as its dates are, or in a locale asked for by name. */
function numbersIn(asked: string | undefined): Intl.NumberFormat {
  const tag = asked == null ? [] : Intl.NumberFormat.supportedLocalesOf([asked]);

  return new Intl.NumberFormat(tag[0] ?? formattingLocale('en', getLocales()[0]?.languageTag));
}

/** Check-in records an arrival or an undo every few seconds, and Today changes in place. */
function useLive(on: boolean): Counts {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!on) return undefined;
    const timer = setInterval(() => setStep((at) => (at + 1) % LIVE.length), 4000);

    return () => clearInterval(timer);
  }, [on]);

  return LIVE[step] ?? COUNTS.none;
}

function countsOf(state: ArrivedState, live: Counts) {
  return state === 'live' ? live : COUNTS[state];
}

function isMoment(name: string | undefined): name is MomentName {
  return MOMENTS.some((moment) => moment === name);
}

export default function DemoTodayScreen() {
  const params = useLocalSearchParams<{
    moment?: string;
    toast?: string;
    switcher?: string;
    create?: string;
    orgs?: string;
    now?: string;
    arrived?: string;
    numbers?: string;
    invites?: string;
  }>();
  const place = useCurrentPlace();
  // An organisation made in the walk has no events yet.
  const name = place?.fresh === true ? 'first' : isMoment(params.moment) ? params.moment : 'plan';
  const { i18n } = useTranslation();
  // The demo's words are English, so its dates are too, in the phone's own region.
  const say = useMemo(() => sayIn(formattingLocale('en', getLocales()[0]?.languageTag)), []);
  const arrivedState = isArrivedState(params.arrived) ? params.arrived : null;
  // Nobody arrived and arrivals coming in are day 1, at Guests A's door; the rest are day 2.
  const at = name === 'dayNow' && arrivedState != null ? ARRIVED_AT[arrivedState] : undefined;
  const guests = name === 'plan' && params.invites === 'none' ? INVITES_NOT_SENT : undefined;
  const moment = useMemo(
    () => momentOf(name, say, i18n.getFixedT('en'), { at, guests }),
    [name, say, i18n, at, guests],
  );
  const numbers = useMemo(() => numbersIn(params.numbers), [params.numbers]);
  const live = useLive(arrivedState === 'live');
  const run = useMemo(
    () =>
      isRunState(params.now)
        ? withRun(
            moment,
            params.now,
            figureOf(countsOf(arrivedState ?? 'some', live), numbers),
            say,
          )
        : null,
    [moment, params.now, arrivedState, live, numbers, say],
  );
  const arrived = useMemo(
    () =>
      name !== 'dayNow' || arrivedState == null
        ? null
        : withArrived(moment, countsOf(arrivedState, live), numbers),
    [name, arrivedState, moment, live, numbers],
  );
  const { kind } = useLayout();
  const [told, setTold] = useState(params.toast);
  const tell = useCallback<Tell>((words) => setTold(words), []);
  const shell = useMemo(
    () =>
      demoShell(tell, {
        events: toEvents,
        calendar: toCalendar,
        event: (key) => openEvent(EVENT_OF_KEY[key]),
      }),
    [tell],
  );
  const toList = useCallback(() => router.dismissTo('/demo'), []);
  const navigation = useNavigation();

  // Signed in, the steps behind are gone: Back goes to the list, never into sign-in.
  useSystemBack(true, toList);
  // With Today's own swipe off, the edge swipe would close the whole demo instead.
  useFocusEffect(
    useCallback(() => {
      const demo = navigation.getParent();
      demo?.setOptions({ gestureEnabled: false });

      return () => demo?.setOptions({ gestureEnabled: true });
    }, [navigation]),
  );
  const bar = kind === 'tabletLandscape' || place == null ? 'dark' : 'light';
  useCoverStatusBar(bar, false);

  const notices = (
    <SwitchedNotice style={kind === 'tabletLandscape' ? undefined : styles.switched} />
  );

  const onTab = useCallback((tab: Tab) => {
    if (tab === 'Settings') router.replace('/demo/settings');
    else if (tab === 'Events') toEvents();
    else if (tab === 'Calendar') toCalendar();
  }, []);

  return (
    <OrgSwitcherProvider
      // A deep link to another state starts it afresh, as opening it from the index does.
      key={[params.switcher, params.create, params.orgs].join('|')}
      state={switcherStateOf(params.switcher)}
      create={createStateOf(params.create)}
      none={params.orgs === 'none'}
      statusBar={bar}
      tell={tell}
    >
      <TodayShellProvider value={shell}>
        <View style={styles.fill}>
          {place == null ? (
            <NoOrganisation tell={tell} />
          ) : run != null ? (
            <RunTodayScreen moment={run} onTab={onTab} notices={notices} />
          ) : arrived != null ? (
            <ArrivedTodayScreen moment={arrived} onTab={onTab} notices={notices} />
          ) : (
            <TodayScreen moment={moment} onTab={onTab} notices={notices} />
          )}
          {told != null && (
            <Told
              words={told}
              phone={kind === 'phone' && place != null}
              onClose={() => setTold(undefined)}
            />
          )}
        </View>
      </TodayShellProvider>
    </OrgSwitcherProvider>
  );
}

function Told({ words, phone, onClose }: { words: string; phone: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, tokens.spaceLg) + (phone ? TAB_BAR + tokens.spaceLg : 0);

  return (
    <View style={[styles.toast, { bottom }]}>
      <Toast key={words} words={words} onClose={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  switched: { marginBottom: tokens.spaceXl },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
