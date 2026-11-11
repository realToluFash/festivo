import type { CalendarFeedLink } from '@soirely/api-client';
import { firstDayOfWeek, formattingLocale, wallDay } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Href, router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { type BoardLoad, CalendarBoard, type ShowParts } from '../../components/CalendarBoard.tsx';
import { type ShowChoice, SubscribeRound } from '../../components/CalendarControls.tsx';
import {
  DayRow,
  MilestoneLead,
  type RowProps,
  RowLine,
  YouTag,
  leadSide,
} from '../../components/CalendarDay.tsx';
import { CalendarFeed, type FeedSource } from '../../components/CalendarSubscribe.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { PHONE_TAB_BAR, PhoneTabBar, TabBarFade } from '../../components/TodayCover.tsx';
import type { Item as ProductItem } from '../../kit/calendar.ts';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import { openEvent } from '../events/EventsList.tsx';
import { CLOCKS, EVENT_OF_KEY, READER_ZONE } from '../events/EventsSample.ts';
import { W } from '../events/EventsWords.ts';
import { Bell, Landscape, OrgPill, PortraitTop } from '../settings/Frame.tsx';
import {
  type CalendarState,
  type Feed,
  NOW,
  type Show,
  calendarEvents,
  daysOf,
  itemHref,
  needsLabel,
  needsLanding,
  needsWhen,
  overdueIn,
  sampleOf,
  showWords,
  startOf,
} from './CalendarModel.ts';
import { CW } from './CalendarWords.ts';
import { useShell } from '../../components/settingsShell.ts';
import { Pill } from '../../components/SettingsParts.tsx';
import { SwitchedNotice } from '../../components/SwitchedNotice.tsx';
import { TOP_TITLE, topTitle } from '../../components/topTitle.ts';

/** The demo keeps its own place, so it never moves the real Calendar's. */
const KEPT = 'soirely.demo.calendar';
const TODAY = wallDay(CLOCKS.reader, READER_ZONE);
const RETRY_MS = 900;

const LINKS = [
  'https://soirely.app/api/calendar-feeds/pV3kQ8sLm2Xr7TnB0cYw5Hd9JfAe4GuZ1oKi6bRtNqM.ics',
  'https://soirely.app/api/calendar-feeds/Zt4bWq9Lr2Hk7Vx0Ns5Jd8Fc3Gm6Pa1YuEo4TiRyQwB.ics',
].map((url) => ({ url, webcal: url.replace(/^https:/, 'webcal:') }));

const NEEDS_LATE = (item: ProductItem) => overdueIn(item, 'needs');

/** A row under Only what needs you: the title and You, its time (the clock and Overdue once due), then the event it is for. */
function NeedsRow({ item, locale, big, onOpen }: RowProps) {
  const late = overdueIn(item, 'needs');

  return (
    <DayRow
      item={item}
      big={big}
      lead={<MilestoneLead item={item} side={leadSide(big)} />}
      tag={<YouTag />}
      label={needsLabel(item, locale)}
      onOpen={onOpen}
    >
      <View style={styles.when}>
        {late && <Glyph name="clock" size={13} ink={tokens.colorBroken} weight={2.4} />}
        <RowLine words={needsWhen(item, locale)} figures late={late} />
      </View>
      <RowLine words={item.event.name} />
    </DayRow>
  );
}

const openItem = (item: ProductItem) => router.push(itemHref(item) as Href);

/** The Calendar in B, weeks as lanes, on the demo's sample: every state the AC names, by ?state=. */
export function CalendarPage({ state }: { state: CalendarState | null }) {
  const { t } = useTranslation();
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const phone = shell.layout === 'phone';
  const { locale, firstDay } = useMemo(() => {
    const dates = formattingLocale('en', getLocales()[0]?.languageTag);

    return { locale: dates, firstDay: firstDayOfWeek(dates) };
  }, []);
  const start = useMemo(() => startOf(state, TODAY), [state]);
  const events = useMemo(() => calendarEvents(sampleOf(state), NOW, start.needs), [state, start]);

  const [feed, setFeed] = useState(start.feed != null);
  const [feedStart, setFeedStart] = useState<Feed>(start.feed ?? 'panel');
  const [load, setLoad] = useState<BoardLoad>(start.load);
  const subscribeRef = useRef<ViewInstance>(null);
  const tell = shell.tell;

  const retry = () => {
    setLoad('loading');
    setTimeout(() => setLoad('loaded'), RETRY_MS);
  };
  const subscribe = () => {
    setFeedStart('panel');
    setFeed(true);
  };
  const closeFeed = useCallback(() => setFeed(false), []);
  const reads = useRef(0);
  const source = useMemo<FeedSource>(
    () => ({
      ...(state === 'subscribeLoading' || state === 'subscribeUnreadable'
        ? {}
        : { known: LINKS[0]! }),
      read: () => {
        reads.current += 1;
        if (state === 'subscribeLoading') return new Promise<CalendarFeedLink>(() => undefined);
        if (state === 'subscribeUnreadable' && reads.current === 1)
          return Promise.reject(new Error());
        return Promise.resolve(LINKS[0]!);
      },
      reset: async () => LINKS[1]!,
      openInApp: async () => {
        setFeed(false);
        tell(CW.openApp);
      },
    }),
    [state, tell],
  );

  const choices = useMemo<ShowChoice<Show>[]>(
    () => [
      { value: 'all', word: t('calendar.showAll') },
      { value: 'events', word: t('calendar.showEvents') },
      { value: 'needs', word: CW.showNeedsYou },
    ],
    [t],
  );
  const partsOf = useCallback(
    (show: Show): ShowParts =>
      show === 'needs'
        ? {
            Row: NeedsRow,
            lateOf: NEEDS_LATE,
            ...showWords(show),
            everyMonth: true,
            landing: needsLanding,
          }
        : showWords(show),
    [t],
  );

  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);
  const bottom = phone ? foot + PHONE_TAB_BAR + tokens.space3xl : insets.bottom + tokens.space3xl;

  const title = (
    <View style={styles.titleRow}>
      <Text
        size={TOP_TITLE}
        weight="bold"
        accessibilityRole="header"
        maxFontSizeMultiplier={44 / TOP_TITLE}
        style={[styles.grow, topTitle]}
      >
        {t('calendar.title')}
      </Text>
      {phone ? (
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
      )}
      {shell.layout === 'landscape' && <Bell tell={tell} />}
    </View>
  );

  const board = (
    <CalendarBoard
      load={load}
      events={events}
      daysOf={daysOf}
      choices={choices}
      firstShow={start.show}
      partsOf={partsOf}
      layout={shell.layout}
      today={TODAY}
      readerZone={READER_ZONE}
      locale={locale}
      firstDay={firstDay}
      kept={KEPT}
      start={start}
      bottom={bottom}
      head={
        <>
          {title}
          <SwitchedNotice />
        </>
      }
      onOpen={openItem}
      onRetry={retry}
      onCreate={
        state === 'noneAsk' ? undefined : () => tell(`${W.firstRunCreate} has its own design.`)
      }
    />
  );

  const feedPanel = (
    <CalendarFeed
      open={feed}
      onClose={closeFeed}
      opener={subscribeRef}
      phone={phone}
      upright={shell.layout === 'portrait'}
      organisationName={SAMPLE.organisation}
      source={source}
      start={feedStart}
    />
  );

  if (shell.layout === 'landscape')
    return (
      <Landscape
        column={null}
        at="Calendar"
        onEvent={(key) => openEvent(EVENT_OF_KEY[key])}
        overlay={feedPanel}
      >
        <View style={styles.pane}>{board}</View>
      </Landscape>
    );

  if (shell.layout === 'portrait')
    return (
      <View style={styles.page}>
        <PortraitTop at="Calendar" />
        <View style={styles.portrait}>{board}</View>
        {feedPanel}
      </View>
    );

  return (
    <View style={styles.page}>
      <View style={{ height: insets.top }} />
      <View style={styles.phone}>
        <View style={styles.orgRow}>
          <OrgPill />
          <View style={styles.grow} />
          <Bell tell={tell} />
        </View>
        {board}
      </View>
      <TabBarFade />
      <PhoneTabBar bottom={foot} onTab={shell.onTab} at="Calendar" />
      {feedPanel}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  phone: { flex: 1, paddingTop: tokens.spaceXxs, paddingHorizontal: tokens.spaceXxl },
  portrait: { flex: 1, paddingTop: 26, paddingHorizontal: tokens.space5xl },
  pane: { flex: 1, paddingTop: 26, paddingHorizontal: 30 },
  orgRow: { flexDirection: 'row', alignItems: 'center', marginBottom: tokens.spaceSm },
  titleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  when: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXxs },
});
