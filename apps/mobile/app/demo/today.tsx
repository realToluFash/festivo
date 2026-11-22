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
import { withBoldText } from '../../src/demo/boldText/BoldTextSwitch.tsx';
import { createStateOf } from '../../src/demo/createOrg/CreateWalk.ts';
import { NoOrganisation } from '../../src/demo/createOrg/NoOrganisation.tsx';
import { noOrgBoardOf } from '../../src/demo/settings/fromNone.ts';
import { OrgSwitcherProvider, useCurrentPlace } from '../../src/demo/OrgSwitcher.tsx';
import { switcherStateOf } from '../../src/demo/OrgSwitcherModel.ts';
import { isNeedsState, MOMENTS, momentOf, planGuests, sayIn } from '../../src/demo/today.ts';
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
import { NeedsTodayScreen } from '../../src/demo/today/NeedsToday.tsx';
import { PlanTodayLandscape } from '../../src/demo/today/PlanToday.tsx';
import { RunTodayScreen } from '../../src/demo/today/RunToday.tsx';
import { isRunState, withRun } from '../../src/demo/today/runOfShow.ts';
import { isReadsState, useNowReads } from '../../src/demo/today/nowReads.tsx';
import type { MomentName } from '../../src/kit/today.ts';
import type { Tab } from '../../src/components/TodayCover.tsx';
import type { Tell } from '../../src/components/TodayParts.tsx';
import { TAB_BAR, TodayScreen } from '../../src/components/TodayScreen.tsx';
import { TodayShellProvider } from '../../src/components/todayShell.ts';
import { demoShell } from '../../src/demo/demoShell.ts';
import { openEvent } from '../../src/demo/events/openEvent.ts';
import { openedOver } from '../../src/demo/events/opener.ts';
import { openSearch } from '../../src/demo/search/SearchHeader.tsx';
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

function DemoTodayScreen() {
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
    figures?: string;
    needs?: string;
    starts?: string;
    reads?: string;
    state?: string;
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
  const guests = name === 'plan' ? planGuests(params.invites, params.figures) : undefined;
  const needing = name === 'plan' && isNeedsState(params.needs) ? params.needs : undefined;
  const later = name === 'plan' && params.starts === 'later';
  const moment = useMemo(
    () => momentOf(name, say, i18n.getFixedT('en'), { at, guests, needing, later }),
    [name, say, i18n, at, guests, needing, later],
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
  const readsState = run != null && isReadsState(params.reads) ? params.reads : null;
  // Now's own reads aging (sc-62416): `?reads=` shows the line, or runs the reads live; without it Now is as sc-29875 left it.
  const reads = useNowReads(readsState, run?.time ?? '16:40', say.locale);
  const shownRun =
    run == null || readsState == null ? run : reads.built ? null : { ...run, asOf: reads.asOf };
  const built = readsState != null && reads.built;
  // A refused read, or a first read that never lands, leaves Now as the product builds it today: `?moment=dayNow`'s.
  const drawn = useMemo(
    () => (built ? momentOf('dayNow', say, i18n.getFixedT('en')) : moment),
    [built, say, i18n, moment],
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
        event: (key) => openEvent(EVENT_OF_KEY[key], openedOver('today')),
        search: openSearch,
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
    <>
      <SwitchedNotice style={kind === 'tabletLandscape' ? undefined : styles.switched} />
      {reads.controls}
    </>
  );

  const onTab = useCallback((tab: Tab) => {
    if (tab === 'Settings') router.replace('/demo/settings');
    else if (tab === 'Events') toEvents();
    else if (tab === 'Calendar') toCalendar();
  }, []);

  return (
    <OrgSwitcherProvider
      // A deep link to another state starts it afresh, as opening it from the index does.
      key={[params.switcher, params.create, params.orgs, params.state].join('|')}
      state={switcherStateOf(params.switcher)}
      create={createStateOf(params.create)}
      none={params.orgs === 'none'}
      invited={params.state === 'invitations'}
      statusBar={bar}
      tell={tell}
    >
      <TodayShellProvider value={shell}>
        <View style={styles.fill}>
          {place == null ? (
            <NoOrganisation tell={tell} board={noOrgBoardOf(params.state)} />
          ) : shownRun != null ? (
            <RunTodayScreen moment={shownRun} onTab={onTab} notices={notices} />
          ) : arrived != null ? (
            <TodayScreen moment={arrived} onTab={onTab} notices={notices} />
          ) : drawn.needs != null ? (
            <NeedsTodayScreen moment={drawn} onTab={onTab} notices={notices} />
          ) : kind === 'tabletLandscape' ? (
            <PlanTodayLandscape moment={drawn} onTab={onTab} notices={notices} />
          ) : (
            <TodayScreen moment={drawn} onTab={onTab} notices={notices} />
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

export default withBoldText(DemoTodayScreen);

const styles = StyleSheet.create({
  fill: { flex: 1 },
  switched: { marginBottom: tokens.spaceXl },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
