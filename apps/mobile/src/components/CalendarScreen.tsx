import type { ListedEvent } from '@soirely/api-client';
import {
  type CalendarShow,
  calendarDays,
  firstDayOfWeek,
  roleHolds,
  serverClock,
  shownPhase,
  wallDay,
} from '@soirely/domain';
import { type Href, router } from 'expo-router';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { type CalEvent, type Item, calEventOf } from '../kit/calendar.ts';
import { useServerNow } from '../kit/serverNow.ts';
import { type LayoutKind, useAccessibilitySizes, useLayout } from '../layout/useLayout.ts';
import { NOT_OFFLINE, type ScreenOffline, useHandOffline, useOffline } from '../offline.ts';
import { afterFailedLoad } from '../offlineLoad.ts';
import { rereadOrganisations, useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AppFrame } from './AppFrame.tsx';
import { CalendarBoard, type ShowParts } from './CalendarBoard.tsx';
import { type ShowChoice, Subscribe } from './CalendarControls.tsx';
import { CalendarFeed, apiFeed } from './CalendarSubscribe.tsx';
import { Refreshing } from './Refreshing.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { layoutOf } from './settingsShell.ts';
import type { TextHandle } from './Text.tsx';
import { useUnderTabs } from './underTabs.ts';
import { LIST_EDGES } from './listFrame.ts';

type Load =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; events: ListedEvent[]; at: Date };

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function openItem(item: Item) {
  const id = encodeURIComponent(item.event.id);
  const href: Href = item.kind === 'event' ? `/events/${id}` : `/events/${id}/dates`;

  router.push(href);
}

const daysOf = (events: readonly CalEvent[], show: CalendarShow) => calendarDays(events, show);

/** Calendar, `Calendar-*` (sc-3625): the organisation's events and their milestones as weeks of lanes, or as Agenda, with its band and Refreshing… (sc-27086). */
export function CalendarScreen() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { account, organisation } = useSignedIn();
  const title = useRef<TextHandle>(null);
  const subscribeRef = useRef<ViewInstance>(null);
  const [offline, setOffline] = useState<ScreenOffline>(NOT_OFFLINE);
  const [feed, setFeed] = useState(false);
  const organisationId = organisation?.id;
  const source = useMemo(
    () => (organisationId == null ? null : apiFeed(organisationId)),
    [organisationId],
  );

  const subscribe = () => setFeed(true);
  // From AX1 on an iPad, Refreshing… and Subscribe leave the title's row for one under it, so the title keeps its row whole (sc-79265).
  const under = useAccessibilitySizes() && kind !== 'phone';
  const ends = (
    <View style={[styles.beside, under && kind === 'tabletPortrait' && styles.underTitle]}>
      {offline.refreshing && <Refreshing testID="calendar.refreshing" />}
      {organisation != null && (
        <View style={under && styles.shrink}>
          <Subscribe
            phone={kind === 'phone'}
            grows={under}
            onPress={subscribe}
            ref={subscribeRef}
          />
        </View>
      )}
    </View>
  );

  return (
    <AppFrame
      current="calendar"
      top="stays"
      listUnderTabs
      switchedAt={styles.switched}
      title={t('calendar.title')}
      titleRef={title}
      offline={offline.stale}
      besideTitle={under ? undefined : ends}
      underTitle={under ? ends : undefined}
    >
      {organisation != null && account != null && (
        <CalendarOf
          key={`${account.id}/${organisation.id}`}
          personId={account.id}
          organisationId={organisation.id}
          creates={roleHolds(organisation, 'events.create')}
          kind={kind}
          heading={title}
          onOffline={setOffline}
        />
      )}
      {organisation != null && source != null && (
        <CalendarFeed
          key={`feed:${organisation.id}`}
          open={feed}
          onClose={() => setFeed(false)}
          opener={subscribeRef}
          phone={kind === 'phone'}
          upright={kind === 'tabletPortrait'}
          organisationName={organisation.name}
          source={source}
        />
      )}
    </AppFrame>
  );
}

function CalendarOf({
  personId,
  organisationId,
  creates,
  kind,
  heading,
  onOffline,
}: {
  personId: string;
  organisationId: string;
  creates: boolean;
  kind: LayoutKind;
  heading: RefObject<TextHandle | null>;
  onOffline: (offline: ScreenOffline) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const underTabs = useUnderTabs();
  const now = useServerNow();
  const locale = dateLocale();
  const firstDay = firstDayOfWeek(locale);
  const [zone] = useState(readerZone);
  const [today] = useState(() => wallDay(serverClock.now(), zone));
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);

  const { watch, stale, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setRefresh((n) => n + 1),
    focusTitle: () => moveScreenReaderFocus(heading.current),
  });

  useHandOffline(onOffline, { stale, refreshing });

  useEffect(() => {
    let live = true;

    watch(api.allEvents(organisationId)).then(
      (events) => live && setLoad({ kind: 'loaded', events, at: serverClock.now() }),
      (error: unknown) => live && setLoad((was) => afterFailedLoad(was, error, { kind: 'failed' })),
    );

    return () => {
      live = false;
    };
  }, [organisationId, attempt, refresh, watch]);

  const events = useMemo(
    () =>
      load.kind === 'loaded'
        ? load.events.map((event) => calEventOf(event, shownPhase(event, load.at, now)))
        : [],
    [load, now],
  );
  const choices = useMemo<ShowChoice<CalendarShow>[]>(
    () => [
      { value: 'all', word: t('calendar.showAll') },
      { value: 'events', word: t('calendar.showEvents') },
    ],
    [t],
  );
  const parts = useMemo<ShowParts>(
    () => ({
      emptyDay: t('calendar.emptyDay'),
      emptyMonth: (month) => t('calendar.emptyMonth', { month }),
    }),
    [t],
  );
  const partsOf = useCallback(() => parts, [parts]);
  const retry = () => {
    void rereadOrganisations();
    setLoad({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  return (
    <View style={[styles.page, PAGE[kind]]}>
      <CalendarBoard
        load={load.kind}
        events={events}
        daysOf={daysOf}
        choices={choices}
        firstShow="all"
        partsOf={partsOf}
        layout={layoutOf(kind)}
        today={today}
        readerZone={zone}
        now={now}
        locale={locale}
        firstDay={firstDay}
        personId={personId}
        bottom={kind === 'phone' ? underTabs + tokens.space3xl : insets.bottom + tokens.space3xl}
        onOpen={openItem}
        onRetry={retry}
        onCreate={creates ? () => router.push('/events/new') : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  beside: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  underTitle: { marginTop: tokens.spaceXxs },
  shrink: { flexShrink: 1, minWidth: 0 },
  switched: { marginTop: 0 },
});

const PAGE: Record<LayoutKind, { paddingHorizontal: number }> = {
  phone: { paddingHorizontal: LIST_EDGES.phone.paddingHorizontal },
  tabletPortrait: { paddingHorizontal: LIST_EDGES.tabletPortrait.paddingHorizontal },
  tabletLandscape: { paddingHorizontal: LIST_EDGES.tabletLandscape.paddingHorizontal },
};
