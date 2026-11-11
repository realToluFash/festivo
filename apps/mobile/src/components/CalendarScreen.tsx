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
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { type CalEvent, type Item, calEventOf } from '../kit/calendar.ts';
import { useServerNow } from '../kit/serverNow.ts';
import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { NOT_OFFLINE, type ScreenOffline, useHandOffline, useOffline } from '../offline.ts';
import { afterFailedLoad } from '../offlineLoad.ts';
import { rereadOrganisations, useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AppFrame } from './AppFrame.tsx';
import { CalendarBoard, type ShowParts } from './CalendarBoard.tsx';
import { type ShowChoice, SubscribeRound } from './CalendarControls.tsx';
import { CalendarFeed, apiFeed } from './CalendarSubscribe.tsx';
import { Refreshing } from './Refreshing.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { layoutOf } from './settingsShell.ts';
import { Pill } from './SettingsParts.tsx';
import type { TextHandle } from './Text.tsx';

const KEPT = 'soirely.calendar';

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
  const { organisation } = useSignedIn();
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

  return (
    <AppFrame
      current="calendar"
      title={t('calendar.title')}
      titleRef={title}
      offline={offline.stale}
      besideTitle={
        <View style={styles.beside}>
          {offline.refreshing && <Refreshing testID="calendar.refreshing" />}
          {organisation != null &&
            (kind === 'phone' ? (
              <SubscribeRound onPress={subscribe} ref={subscribeRef} />
            ) : (
              <Pill
                label={t('calendarFeed.open')}
                kind="secondary"
                glyph="calendar"
                height={tokens.sizeHit}
                full={false}
                onPress={subscribe}
                ref={subscribeRef}
                testID="calendarFeed.open"
              />
            ))}
        </View>
      }
    >
      {organisation != null && (
        <CalendarOf
          key={organisation.id}
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
  organisationId,
  creates,
  kind,
  heading,
  onOffline,
}: {
  organisationId: string;
  creates: boolean;
  kind: LayoutKind;
  heading: RefObject<TextHandle | null>;
  onOffline: (offline: ScreenOffline) => void;
}) {
  const { t } = useTranslation();
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
        locale={locale}
        firstDay={firstDay}
        kept={KEPT}
        bottom={tokens.space3xl}
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
});

const PAGE: Record<LayoutKind, { paddingHorizontal: number }> = {
  phone: { paddingHorizontal: tokens.spaceXxl },
  tabletPortrait: { paddingHorizontal: tokens.space4xl },
  tabletLandscape: { paddingHorizontal: 30 },
};
