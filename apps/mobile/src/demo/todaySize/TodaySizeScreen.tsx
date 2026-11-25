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
import { SizeEvents } from './TodaySizeEvents.tsx';
import {
  HEAD,
  HEAD_LINK,
  NEXT_UP,
  SIZE_EVENTS,
  TODAY_EVENT_NAMES,
  TODAY_GREETINGS,
  TODAY_NAMES,
  type TodayEventName,
  type TodayGreeting,
  type TodayName,
  greetingMost,
  greetingName,
  greetingSize,
  linkUnder,
  sizeEvents,
  subSize,
  weekWidth,
  wordsStart,
} from './todaySizeRules.ts';

export interface TodaySizeStart {
  size: FilterSize;
  language: FilterLanguage;
  name: TodayName;
  greeting: TodayGreeting;
  event: TodayEventName;
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

  const page = (
    <I18nextProvider i18n={words}>
      <TodayPage
        kind={kind}
        scale={scale}
        language={language}
        name={name}
        greeting={greeting}
        event={event}
      />
    </I18nextProvider>
  );
  const choices = (
    <View style={styles.choices}>
      <DemoOnly title="Stand-ins for the device’s text size, its language, the account’s first name, the time of day and the events’ names. The greeting, every section heading and every row under Your events (a tile on the phone) draw at the size chosen; the sidebar stays as main draws it at this device’s size. From AX1 each text wraps only between words, a word too wide for its line steps that text alone down until it fits, never under its default size, and every line of one text is one size. A comma stays on the word before it, so the greeting breaks after it (Bonjour, / QA), and a name breaks only after its own hyphen. From AX1 See all and Calendar take the line under their heading, no heading starts larger than the greeting, a row’s thumbnail sits above its words, a tile is the phone’s width less a glimpse of the next and its chips sit under its dates, and nothing in a row starts larger than its event’s name. One long word draws at its default size and breaks inside itself, as on main. At the standard sizes Today is main’s. Nothing is sent and no string is added.">
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
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}
      >
        <NavBar />
        {page}
        {choices}
      </ScrollView>
    </View>
  );
}

function TodayPage({
  kind,
  scale,
  language,
  name,
  greeting,
  event,
}: {
  kind: LayoutKind;
  scale: number;
  language: FilterLanguage;
  name: TodayName;
  greeting: TodayGreeting;
  event: TodayEventName;
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
  const cap = greetingDrawn ?? Infinity;

  const needs = <Head title={t('todayScreen.needsYou')} count={2} scale={scale} cap={cap} />;
  const week = (
    <>
      <Head
        title={t('todayScreen.thisWeek')}
        link={t('todayScreen.tab.calendar')}
        onLink={() => router.replace('/demo/calendar')}
        scale={scale}
        cap={cap}
      />
      <NextUp scale={scale} cap={cap} when={say.day(PARTY_DAY)} />
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
      <Cover
        kind={kind}
        scale={scale}
        eyebrow={say.long(TODAY)}
        hello={hello}
        sub={sub}
        onDrawn={setGreetingDrawn}
      />
      {kind === 'tabletLandscape' ? (
        <View style={styles.columns}>
          <View style={styles.grow}>
            {needs}
            <View style={styles.gapAbove}>{week}</View>
          </View>
          <View style={styles.eventsColumn}>{events}</View>
        </View>
      ) : kind === 'tabletPortrait' ? (
        <View style={styles.sections}>
          {needs}
          <View style={[styles.columns, styles.gapAbove]}>
            <View style={{ width: weekWidth(width) }}>{week}</View>
            <View style={styles.grow}>{events}</View>
          </View>
        </View>
      ) : (
        <View style={styles.sections}>
          {needs}
          <View style={styles.gapAbove}>{week}</View>
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
  onDrawn,
}: {
  kind: LayoutKind;
  scale: number;
  eyebrow: string;
  hello: string;
  sub: string;
  onDrawn: (size: number) => void;
}) {
  const [room, setRoom] = useState(0);
  const [drawn, setDrawn] = useState<number | null>(null);
  const size = greetingSize(kind);
  const line = subSize(kind);
  const lineAt = wordsStart(line, scale, drawn ?? Infinity);

  return (
    <View style={kind === 'tabletLandscape' ? styles.banner : styles.cover}>
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
