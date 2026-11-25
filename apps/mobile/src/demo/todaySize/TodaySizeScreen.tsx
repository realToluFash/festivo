import { type Href, router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import type { Tab } from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { Toast } from '../../components/Toast.tsx';
import { TodayShellProvider } from '../../components/todayShell.ts';
import type { LayoutKind } from '../../layout/classify.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { NavBar } from '../DemoScreen.tsx';
import { demoShell } from '../demoShell.ts';
import { OrgSwitcherProvider } from '../OrgSwitcher.tsx';
import { DemoSidebar } from '../Sidebar.tsx';
import { openEvent } from '../events/openEvent.ts';
import { EVENT_OF_KEY } from '../events/EventsSample.ts';
import { openedOver } from '../events/opener.ts';
import {
  FILTER_LANGUAGES,
  FILTER_SIZES,
  type FilterLanguage,
  type FilterSize,
  filterScale,
} from '../filterSize/filterSizeRules.ts';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import { EVENTS, type EventKey, sample, sayIn } from '../today.ts';
import { FitWords } from './FitWords.tsx';
import { LiveBanner } from './TodaySizeLive.tsx';
import { PillRow } from './TodaySizePill.tsx';
import { SizeEvents } from './TodaySizeEvents.tsx';
import { SizeOrg, orgId } from './TodaySizeSwitcher.tsx';
import { UprightRow } from './TodaySizeUpright.tsx';
import { WeekDays } from './TodaySizeWeek.tsx';
import {
  HEAD,
  HEAD_LINK,
  NEXT_UP,
  SIZE_EVENTS,
  TODAY_EVENT_NAMES,
  TODAY_GREETINGS,
  TODAY_INVITES,
  TODAY_LIVES,
  TODAY_NAMES,
  TODAY_ORGS,
  TODAY_VENUES,
  TODAY_WEEKS,
  type TodayEventName,
  type TodayGreeting,
  type TodayInvite,
  type TodayLive,
  type TodayName,
  type TodayOrg,
  type TodayVenue,
  type TodayWeek,
  greetingMost,
  greetingName,
  greetingSize,
  linkUnder,
  liveName,
  orgName,
  sizeEvents,
  subSize,
  venueName,
  weekWidth,
  wordsStart,
} from './todaySizeRules.ts';

export interface TodaySizeStart {
  size: FilterSize;
  language: FilterLanguage;
  name: TodayName;
  greeting: TodayGreeting;
  event: TodayEventName;
  org: TodayOrg;
  invite: TodayInvite;
  live: TodayLive;
  venue: TodayVenue;
  week: TodayWeek;
  switcher: boolean;
}

const TODAY = '2026-11-25';
const KEYS: readonly EventKey[] = ['wed', 'ireti', 'party', 'draft'];
// The party is on Sunday 29 November here, so Your events reads dimanche 29 nov. (sc-92090).
const PARTY_DAY = SIZE_EVENTS[0]?.first ?? EVENTS.party.first;

function toTab(tab: Tab) {
  if (tab === 'Events') router.replace('/demo/events');
  if (tab === 'Calendar') router.replace('/demo/calendar');
  if (tab === 'Settings') router.replace('/demo/settings' as Href);
}

function open(key: EventKey) {
  openEvent(EVENT_OF_KEY[key], openedOver('today'));
}

/** sc-91291: Today's greeting and section headings at a stand-in text size, every word whole and no line starting with a comma. */
export function TodaySizeScreen({ start }: { start: TodaySizeStart }) {
  const { i18n } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [name, setName] = useState(start.name);
  const [greeting, setGreeting] = useState(start.greeting);
  const [event, setEvent] = useState(start.event);
  const [org, setOrg] = useState(start.org);
  const [invite, setInvite] = useState(start.invite);
  const [live, setLive] = useState(start.live);
  const [venue, setVenue] = useState(start.venue);
  const place = useMemo(() => ({ id: orgId(org), name: orgName(org), role: 'Owner' }), [org]);
  const [week, setWeek] = useState(start.week);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const scale = filterScale(size, fontScale);
  const side = kind === 'tabletLandscape';
  const [told, setTold] = useState<string | null>(null);
  const tell = useCallback<Tell>((said) => setTold(said), []);
  const shell = useMemo(
    () =>
      demoShell(tell, {
        events: () => router.replace('/demo/events'),
        calendar: () => router.replace('/demo/calendar'),
        event: open,
      }),
    [tell],
  );

  const sizeOrg = useMemo(
    () => ({
      org,
      onSwitch: (to: TodayOrg, said: string) => {
        setOrg(to);
        tell(said);
      },
      openAtStart: start.switcher,
    }),
    [org, tell, start.switcher],
  );
  const page = (
    <I18nextProvider i18n={words}>
      <SizeOrg.Provider value={sizeOrg}>
        <TodayPage
          kind={kind}
          scale={scale}
          language={language}
          name={name}
          greeting={greeting}
          event={event}
          waiting={invite === 'one' ? 1 : 0}
          live={kind === 'phone' ? null : liveName(live)}
          place={venueName(venue)}
          week={week}
        />
      </SizeOrg.Provider>
    </I18nextProvider>
  );
  const choices = (
    <View style={styles.choices}>
      <DemoOnly title="Stand-ins for the device’s text size, its language, the account’s first name, the time of day, the events’ names, and on the phone and the upright iPad the organisation’s name and its waiting invitations. The greeting, every section heading and every row under Your events (a tile on the phone) draw at the size chosen; the sidebar stays as main draws it at this device’s size. From AX1 each text wraps only between words, a word too wide for its line steps that text alone down until it fits, never under its default size, and every line of one text is one size. A comma stays on the word before it, so the greeting breaks after it (Bonjour, / QA), and a name breaks only after its own hyphen. From AX1 See all and Calendar take the line under their heading, no heading starts larger than the greeting, a row’s thumbnail sits above its words, a tile is the phone’s width less a glimpse of the next and its chips sit under its dates, and nothing in a row starts larger than its event’s name. Under This week each day’s date follows its name after a dot only while both fit one line whole; otherwise the date takes the line under, without its dot. One long word draws at its default size and breaks inside itself, as on main. On the phone the organisation pill’s name and its invitation line step the same way, each alone, the invitation line never larger than the name; where the name’s widest word is too wide for its line even at its default size, the pill is its tile, with its ring while an invitation waits. From AX1 one tap on the phone’s pill opens a stand-in for Where are you working?, drawn at the size chosen as main draws its rows from AX1: each row’s name wraps only between its words and steps down only as far as its widest word needs, never under its default size and with no line limit; a word too wide even then draws at its default size and breaks only where its line is full, every letter shown; the role line and Current each step alone, never larger than the name, and the role line’s dot stays on the word before it. The organisation you are in comes first, one tap on another switches to it, and Create an organisation, at the foot, opens its walk. Below AX1, and on the iPad, the pill opens main’s switcher at this device’s size. On the upright iPad the tabs take their size first and the pill keeps 12 clear of them; it is its tile where the tabs are under their own size or leave it under 120, and from AX1 the tabs, Search and the bell keep to the top while the pill grows down, the greeting below it. On its side, with an event live, the cover is its banner: Live now and Day 1 of 1 each step alone inside their chips and the second takes the line under the first where both do not fit, the name steps until its widest word fits and never draws smaller than the end line under it, and from AX1 Open the event takes the line under the end line; Open the event shows a toast here, as the event page has its own design. Upright, with an event live, the cover sits under the top row: below AX1 it is main’s, and from AX1 Live now and the day’s chip keep main’s size at the size chosen and grow to hold their words, wrapping only between words with the dot kept on the word before it, the day’s chip taking the line under Live now where both do not fit (sc-93211); from AX1 the chips, the name and the end line take the cover’s full width and Open the event takes its own line under the end line, at the name’s left edge, as on its side; the name steps down only as far as its widest word needs, never under its default size and never smaller than the end line, the end line and Open the event each step alone by the same rule, and one word too wide even at its default size breaks inside itself (sc-93578). Venue puts a place on the day’s chip; the cover grows down to hold it and Today scrolls to bring Open the event into view. On the phone the live cover is not drawn here. At the standard sizes Today is main’s. Nothing is sent and no string is added.">
        <Choices
          heading="Text size"
          options={FILTER_SIZES}
          chosen={size}
          onChoose={setSize}
          id="size"
          prefix="demo.todaySize"
        />
        <Choices
          heading="Language"
          options={FILTER_LANGUAGES}
          chosen={language}
          onChoose={setLanguage}
          id="language"
          prefix="demo.todaySize"
        />
        <Choices
          heading="First name"
          options={TODAY_NAMES}
          chosen={name}
          onChoose={setName}
          id="name"
          prefix="demo.todaySize"
        />
        <Choices
          heading="Greeting"
          options={TODAY_GREETINGS}
          chosen={greeting}
          onChoose={setGreeting}
          id="greeting"
          prefix="demo.todaySize"
        />
        <Choices
          heading="Event names"
          options={TODAY_EVENT_NAMES}
          chosen={event}
          onChoose={setEvent}
          id="event"
          prefix="demo.todaySize"
        />
        <Choices
          heading="Organisation"
          options={TODAY_ORGS}
          chosen={org}
          onChoose={setOrg}
          id="org"
          prefix="demo.todaySize"
        />
        <Choices
          heading="Invitations"
          options={TODAY_INVITES}
          chosen={invite}
          onChoose={setInvite}
          id="invite"
          prefix="demo.todaySize"
        />
        <Choices
          heading="Live event"
          options={TODAY_LIVES}
          chosen={live}
          onChoose={setLive}
          id="live"
          prefix="demo.todaySize"
        />
        <Choices
          heading="Venue"
          options={TODAY_VENUES}
          chosen={venue}
          onChoose={setVenue}
          id="venue"
          prefix="demo.todaySize"
        />
        <Choices
          heading="This week"
          options={TODAY_WEEKS}
          chosen={week}
          onChoose={setWeek}
          id="week"
          prefix="demo.todaySize"
        />
      </DemoOnly>
    </View>
  );

  if (side) {
    return (
      <OrgSwitcherProvider state={null} tell={tell}>
        <TodayShellProvider value={shell}>
          <View style={[styles.chrome, { paddingTop: insets.top }]}>
            <DemoSidebar events={KEYS.map(sample)} onTab={toTab} />
            <View
              style={[styles.pageCard, { marginBottom: Math.max(insets.bottom, tokens.spaceMd) }]}
            >
              <ScrollView
                contentContainerStyle={styles.cardPage}
                showsVerticalScrollIndicator={false}
              >
                <NavBar />
                {page}
                {choices}
              </ScrollView>
            </View>
            {told != null && (
              <View style={[styles.toast, { bottom: insets.bottom + tokens.spaceXl }]}>
                <Toast key={told} words={told} onClose={() => setTold(null)} />
              </View>
            )}
          </View>
        </TodayShellProvider>
      </OrgSwitcherProvider>
    );
  }

  return (
    <OrgSwitcherProvider state={null} place={place} tell={tell}>
      <TodayShellProvider value={shell}>
        <View style={styles.screen}>
          <ScrollView
            contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}
          >
            <NavBar />
            {page}
            {choices}
          </ScrollView>
          {told != null && (
            <View style={[styles.toast, { bottom: insets.bottom + tokens.spaceXl }]}>
              <Toast key={told} words={told} onClose={() => setTold(null)} />
            </View>
          )}
        </View>
      </TodayShellProvider>
    </OrgSwitcherProvider>
  );
}

function TodayPage({
  kind,
  scale,
  language,
  name,
  greeting,
  event,
  waiting,
  live,
  place,
  week,
}: {
  kind: LayoutKind;
  scale: number;
  language: FilterLanguage;
  name: TodayName;
  greeting: TodayGreeting;
  event: TodayEventName;
  waiting: number;
  live: string | null;
  place: string | null;
  week: TodayWeek;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const say = sayIn(language);
  const hello = t(`todayScreen.helloName.${greeting}`, { name: greetingName(name) });
  const party = EVENTS.party;
  const sub = t('todayScreen.startsOnWeekday', {
    name: party.name,
    weekday: say.weekdayLong(PARTY_DAY),
  });
  const [greetingDrawn, setGreetingDrawn] = useState<number | null>(null);
  // While an event is live no greeting shows, so nothing caps the headings, as on main.
  const cap = live == null ? (greetingDrawn ?? Infinity) : Infinity;

  const needs = <Head title={t('todayScreen.needsYou')} count={2} scale={scale} cap={cap} />;
  const thisWeek = (
    <>
      <Head
        title={t('todayScreen.thisWeek')}
        link={t('todayScreen.tab.calendar')}
        onLink={() => router.replace('/demo/calendar')}
        scale={scale}
        cap={cap}
      />
      {week === 'days' ? (
        <WeekDays locale={language} scale={scale} cap={cap} wide={kind !== 'phone'} />
      ) : (
        <NextUp scale={scale} cap={cap} when={say.day(PARTY_DAY)} />
      )}
    </>
  );
  const events = (
    <>
      <Head
        title={t('todayScreen.yourEvents')}
        link={t('todayScreen.allEvents')}
        onLink={() => router.replace('/demo/events')}
        scale={scale}
        cap={cap}
      />
      <SizeEvents
        events={sizeEvents(event)}
        locale={language}
        scale={scale}
        cap={cap}
        tiles={kind === 'phone'}
      />
    </>
  );

  return (
    <View style={styles.today}>
      {live != null ? (
        <LiveBanner
          name={live}
          place={place}
          scale={scale}
          top={
            kind === 'tabletPortrait' ? (
              <UprightRow scale={scale} cap={Infinity} waiting={waiting} onTab={toTab} />
            ) : undefined
          }
        />
      ) : (
        <Cover
          kind={kind}
          scale={scale}
          eyebrow={say.long(TODAY)}
          hello={hello}
          sub={sub}
          waiting={waiting}
          onDrawn={setGreetingDrawn}
        />
      )}
      {kind === 'tabletLandscape' ? (
        <View style={styles.columns}>
          <View style={styles.grow}>
            {needs}
            <View style={styles.gapAbove}>{thisWeek}</View>
          </View>
          <View style={styles.eventsColumn}>{events}</View>
        </View>
      ) : kind === 'tabletPortrait' ? (
        <View style={styles.sections}>
          {needs}
          <View style={[styles.columns, styles.gapAbove]}>
            <View style={{ width: weekWidth(width) }}>{thisWeek}</View>
            <View style={styles.grow}>{events}</View>
          </View>
        </View>
      ) : (
        <View style={styles.sections}>
          {needs}
          <View style={styles.gapAbove}>{thisWeek}</View>
          <View style={styles.gapAbove}>{events}</View>
        </View>
      )}
    </View>
  );
}

function Cover({
  kind,
  scale,
  eyebrow,
  hello,
  sub,
  waiting,
  onDrawn,
}: {
  kind: LayoutKind;
  scale: number;
  eyebrow: string;
  hello: string;
  sub: string;
  waiting: number;
  onDrawn: (size: number) => void;
}) {
  const [room, setRoom] = useState(0);
  const [drawn, setDrawn] = useState<number | null>(null);
  const size = greetingSize(kind);
  const line = subSize(kind);
  const lineAt = wordsStart(line, scale, drawn ?? Infinity);

  return (
    <View style={kind === 'tabletLandscape' ? styles.banner : styles.cover}>
      {kind === 'phone' && (
        <View style={styles.coverTop}>
          <PillRow scale={scale} cap={drawn ?? Infinity} waiting={waiting} />
        </View>
      )}
      {kind === 'tabletPortrait' && (
        <View style={styles.coverTop}>
          <UprightRow scale={scale} cap={drawn ?? Infinity} waiting={waiting} onTab={toTab} />
        </View>
      )}
      <View
        style={[styles.foot, greetingMost(kind) != null && { maxWidth: greetingMost(kind) }]}
        onLayout={(event: LayoutChangeEvent) => setRoom(event.nativeEvent.layout.width)}
      >
        <Text
          size={12 * scale}
          weight="semibold"
          allowFontScaling={false}
          style={[styles.white, styles.eyebrow]}
        >
          {eyebrow.toUpperCase()}
        </Text>
        <FitWords
          text={hello}
          size={size}
          scale={scale}
          cap={Infinity}
          room={room}
          weight="bold"
          line={1.08}
          role="header"
          style={[styles.white, { letterSpacing: size * -0.02 }]}
          onDrawn={(at) => {
            setDrawn(at);
            onDrawn(at);
          }}
          testID="demo.todaySize.greeting"
        />
        <Text
          size={lineAt}
          weight="medium"
          allowFontScaling={false}
          style={[styles.white, { lineHeight: Math.ceil(lineAt * 1.45) }]}
        >
          {sub}
        </Text>
      </View>
    </View>
  );
}

function Head({
  title,
  count,
  link,
  onLink,
  scale,
  cap,
}: {
  title: string;
  count?: number;
  link?: string;
  onLink?: () => void;
  scale: number;
  cap: number;
}) {
  const [row, setRow] = useState(0);
  const [badge, setBadge] = useState(0);
  const [drawn, setDrawn] = useState(HEAD * scale);
  const under = linkUnder(scale);
  const room = count == null ? row : badge === 0 ? 0 : row - badge - tokens.spaceMd;
  const linkAt = wordsStart(HEAD_LINK, scale, drawn);

  const heading = (beside?: boolean) => (
    <FitWords
      text={title}
      size={HEAD}
      scale={scale}
      cap={cap}
      room={Math.max(room, 0)}
      weight="bold"
      line={1.15}
      role="header"
      style={[{ letterSpacing: HEAD * -0.02 }, beside && styles.besideCount]}
      onDrawn={setDrawn}
      testID="demo.todaySize.heading"
    />
  );
  const chip = count != null && (
    <View
      style={styles.count}
      onLayout={(event: LayoutChangeEvent) => setBadge(event.nativeEvent.layout.width)}
    >
      <Text
        size={12.5 * Math.min(scale, drawn / 12.5)}
        weight="bold"
        allowFontScaling={false}
        style={styles.onAccent}
      >
        {String(count)}
      </Text>
    </View>
  );
  const more = link != null && (
    <Pressable
      onPress={onLink}
      style={styles.link}
      hitSlop={tokens.spaceSm}
      accessibilityRole="button"
      accessibilityLabel={link}
      testID="demo.todaySize.link"
    >
      <Text
        size={linkAt}
        weight="semibold"
        allowFontScaling={false}
        style={[styles.accent, styles.shrink]}
        accessible={false}
      >
        {link}
      </Text>
      <Glyph name="chevron" size={15} ink={tokens.colorAccent} />
    </Pressable>
  );

  if (!under) {
    return (
      <View style={styles.head}>
        {heading()}
        {chip}
        <View style={styles.grow} />
        {more}
      </View>
    );
  }

  return (
    <View style={styles.headStacked}>
      <View
        style={styles.headLine}
        onLayout={(event: LayoutChangeEvent) => setRow(event.nativeEvent.layout.width)}
      >
        {heading(true)}
        {chip}
      </View>
      {more}
    </View>
  );
}

function NextUp({ scale, cap, when }: { scale: number; cap: number; when: string }) {
  const { t } = useTranslation();
  const [room, setRoom] = useState(0);
  const party = EVENTS.party;

  return (
    <View style={styles.panel}>
      <Pressable
        onPress={() => open('party')}
        style={({ pressed }) => [styles.nextUp, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('todayScreen.nextUpLabel', { name: party.name, when })}
        testID="demo.todaySize.nextUp"
      >
        <View
          style={styles.words}
          onLayout={(event: LayoutChangeEvent) => setRoom(event.nativeEvent.layout.width)}
        >
          <FitWords
            text={t('todayScreen.nextUp').toLocaleUpperCase()}
            size={NEXT_UP}
            scale={scale}
            cap={cap}
            room={room}
            weight="semibold"
            line={1.22}
            style={[styles.secondary, styles.caps]}
          />
          <Text size={15} weight="semibold" accessible={false}>
            {party.name}
          </Text>
          <Text size={13} weight="medium" accessible={false} style={styles.secondary}>
            {when}
          </Text>
        </View>
        <Glyph name="chevron" ink={tokens.colorInkTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colorPage },
  chrome: { flex: 1, flexDirection: 'row', backgroundColor: tokens.colorNeutralFill },
  pageCard: {
    flex: 1,
    marginRight: tokens.spaceMd,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    overflow: 'hidden',
  },
  cardPage: {
    paddingTop: tokens.spaceXxl,
    paddingHorizontal: tokens.space3xl,
    paddingBottom: tokens.space6xl,
  },
  today: { gap: 18 },
  cover: {
    backgroundColor: tokens.colorInk,
    paddingTop: tokens.space6xl,
    paddingBottom: tokens.space4xl,
    paddingHorizontal: tokens.spaceXxl,
  },
  banner: {
    backgroundColor: tokens.colorInk,
    borderRadius: tokens.space4xl,
    paddingTop: tokens.space6xl,
    paddingBottom: tokens.space4xl,
    paddingHorizontal: 30,
  },
  coverTop: { marginTop: -tokens.space4xl, marginBottom: tokens.space4xl },
  foot: { gap: tokens.spaceSm },
  white: { color: tokens.colorInkOnDark },
  eyebrow: { letterSpacing: 12 * 0.08, opacity: 0.92 },
  sections: { paddingHorizontal: tokens.spaceXxl },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space3xl },
  grow: { flex: 1, minWidth: 0 },
  eventsColumn: { width: 316 },
  gapAbove: { marginTop: 28 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceHair,
    marginBottom: tokens.spaceLg,
  },
  headStacked: { paddingHorizontal: tokens.spaceHair, marginBottom: tokens.spaceLg },
  headLine: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  count: {
    minWidth: tokens.space3xl,
    minHeight: tokens.space3xl,
    paddingHorizontal: tokens.spaceSm,
    borderRadius: tokens.spaceLg,
    backgroundColor: tokens.colorAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: tokens.spaceHair,
    minHeight: tokens.sizeHit,
  },
  shrink: { flexShrink: 1 },
  besideCount: { flexShrink: 1, minWidth: 0 },
  panel: {
    backgroundColor: tokens.colorInset,
    borderRadius: tokens.space3xl,
    paddingVertical: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceXl,
  },
  nextUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceLg,
    minHeight: tokens.sizeHit,
  },
  words: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
  secondary: { color: tokens.colorInkSecondary },
  caps: { letterSpacing: 12 * 0.06 },
  accent: { color: tokens.colorAccent },
  onAccent: { color: tokens.colorInkOnDark },
  pressed: { opacity: 0.7 },
  choices: { paddingHorizontal: tokens.spaceXl, paddingTop: tokens.spaceLg },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
