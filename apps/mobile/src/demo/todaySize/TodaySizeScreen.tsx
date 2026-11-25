import { type Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import type { Tab } from '../../components/TodayCover.tsx';
import { EventThumb } from '../../components/TodayParts.tsx';
import type { LayoutKind } from '../../layout/classify.ts';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { NavBar } from '../DemoScreen.tsx';
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
import {
  HEAD,
  HEAD_LINK,
  NEXT_UP,
  TODAY_GREETINGS,
  TODAY_NAMES,
  type TodayGreeting,
  type TodayName,
  greetingMost,
  greetingName,
  greetingSize,
  linkUnder,
  piecesOfLine,
  subSize,
  wordsSize,
  wordsStart,
} from './todaySizeRules.ts';

export interface TodaySizeStart {
  size: FilterSize;
  language: FilterLanguage;
  name: TodayName;
  greeting: TodayGreeting;
}

const TODAY = '2026-11-25';
const KEYS: readonly EventKey[] = ['wed', 'ireti', 'party', 'draft'];

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
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const scale = filterScale(size, fontScale);
  const side = kind === 'tabletLandscape';

  const page = (
    <I18nextProvider i18n={words}>
      <TodayPage kind={kind} scale={scale} language={language} name={name} greeting={greeting} />
    </I18nextProvider>
  );
  const choices = (
    <View style={styles.choices}>
      <DemoOnly title="Stand-ins for the device’s text size, its language, the account’s first name and the time of day. The greeting and every section heading draw at the size chosen; the sidebar and the rows under the headings stay as main draws them at this device’s size. From AX1 each heading and the greeting wrap only between words, a word too wide for its line steps the whole text down until it fits, never under its default size, and every line of one text is one size. A comma stays on the word before it, so the greeting breaks after it (Bonjour, / QA), and a name breaks only after its own hyphen. From AX1 See all and Calendar take the line under their heading, and no heading starts larger than the greeting. At the standard sizes Today is main’s. Nothing is sent and no string is added.">
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
      </DemoOnly>
    </View>
  );

  if (side) {
    return (
      <View style={[styles.chrome, { paddingTop: insets.top }]}>
        <DemoSidebar events={KEYS.map(sample)} onTab={toTab} />
        <View style={[styles.pageCard, { marginBottom: Math.max(insets.bottom, tokens.spaceMd) }]}>
          <ScrollView contentContainerStyle={styles.cardPage} showsVerticalScrollIndicator={false}>
            <NavBar />
            {page}
            {choices}
          </ScrollView>
        </View>
      </View>
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
}: {
  kind: LayoutKind;
  scale: number;
  language: FilterLanguage;
  name: TodayName;
  greeting: TodayGreeting;
}) {
  const { t } = useTranslation();
  const say = sayIn(language);
  const hello = t(`todayScreen.helloName.${greeting}`, { name: greetingName(name) });
  const party = EVENTS.party;
  const sub = t('todayScreen.startsOnWeekday', {
    name: party.name,
    weekday: say.weekdayLong(party.first),
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
      <NextUp scale={scale} cap={cap} when={say.day(party.first)} />
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
      <View style={styles.panel}>
        {KEYS.map((key, index) => (
          <Pressable
            key={key}
            onPress={() => open(key)}
            style={({ pressed }) => [
              styles.eventRow,
              index < KEYS.length - 1 && styles.ruled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            testID={`demo.todaySize.event.${key}`}
          >
            <EventThumb event={sample(key)} side={56} radius={16} />
            <View style={styles.words}>
              <Text size={15} weight="semibold">
                {EVENTS[key].name}
              </Text>
              <Text size={13} weight="medium" style={styles.secondary}>
                {say.day(EVENTS[key].first)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
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

/** A text at the stand-in size whose lines break only between its pieces, all of them one size (sc-69816's rule). */
function FitWords({
  text,
  size,
  scale,
  cap,
  room,
  weight,
  line,
  role,
  style,
  onDrawn,
  testID,
}: {
  text: string;
  size: number;
  scale: number;
  cap: number;
  room: number;
  weight: 'semibold' | 'bold';
  line: number;
  role?: 'header';
  style?: StyleProp<TextStyle>;
  onDrawn?: (size: number) => void;
  testID?: string;
}) {
  const start = wordsStart(size, scale, cap);
  const key = `${start}|${weight}|${text}`;
  const pieces = piecesOfLine(text);
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number> }>({
    key: '',
    widths: {},
  });
  const widths = measured.key === key ? measured.widths : {};
  const widest = pieces.every((piece) => widths[piece] != null)
    ? Math.max(...pieces.map((piece) => widths[piece] ?? 0))
    : null;
  // Below AX1 the text is main's and waits for nothing; from AX1 it is hidden until its room and its widest piece are known.
  const pending = atAccessibilitySizes(scale) && (widest == null || room === 0);
  const drawn =
    pending || widest == null ? start : wordsSize(size, scale, cap, widest, Math.max(room, 1));

  useEffect(() => {
    if (!pending) onDrawn?.(drawn);
  }, [pending, drawn, onDrawn]);

  return (
    <>
      <MeasuredWords
        words={pieces}
        size={start}
        weight={weight}
        allowFontScaling={false}
        onWidth={(piece, width) =>
          setMeasured((now) => {
            const kept = now.key === key ? now.widths : {};

            return kept[piece] === width ? now : { key, widths: { ...kept, [piece]: width } };
          })
        }
      />
      <Text
        // A new size mounts a new Text, so iOS never draws one size in the box laid out for another (sc-69816).
        key={drawn}
        size={drawn}
        weight={weight}
        allowFontScaling={false}
        accessibilityRole={role}
        style={[{ lineHeight: Math.ceil(drawn * line) }, style, pending && styles.waiting]}
        testID={testID}
      >
        {text}
      </Text>
    </>
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
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceLg,
    minHeight: tokens.sizeHit,
  },
  nextUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceLg,
    minHeight: tokens.sizeHit,
  },
  ruled: { borderBottomWidth: 1, borderBottomColor: tokens.colorBorder },
  words: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
  secondary: { color: tokens.colorInkSecondary },
  caps: { letterSpacing: 12 * 0.06 },
  accent: { color: tokens.colorAccent },
  onAccent: { color: tokens.colorInkOnDark },
  pressed: { opacity: 0.7 },
  waiting: { opacity: 0 },
  choices: { paddingHorizontal: tokens.spaceXl, paddingTop: tokens.spaceLg },
});
