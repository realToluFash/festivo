import type { CalendarFeedLink } from '@soirely/api-client';
import { type Ref, useEffect, useMemo, useRef, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Subscribe } from '../../components/CalendarControls.tsx';
import { CalendarFeed, type FeedSource } from '../../components/CalendarSubscribe.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { ListTop } from '../../components/ListTop.tsx';
import { LIST_EDGES } from '../../components/listFrame.ts';
import { useShell } from '../../components/settingsShell.ts';
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { grownPad, wordsIn } from '../../layout/textSize.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { useReducedMotion } from '../../reducedMotion.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { tracking } from '../../theme/tracking.ts';
import { CW } from '../calendar/CalendarWords.ts';
import { FILTER_SIZES, type FilterSize, filterScale } from '../filterSize/filterSizeRules.ts';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import { frameTitleCap } from '../frameTitleCap.ts';
import { Landscape, ListTopEnd, OrgPill, PortraitTop } from '../settings/Frame.tsx';
import {
  HEADER_LANGUAGES,
  HEADER_REFRESHING,
  type HeaderLanguage,
  type HeaderRefreshing,
  SUBSCRIBE_GAP,
  SUBSCRIBE_GLYPH,
  SUBSCRIBE_RING,
  SUBSCRIBE_SIDE,
  SUBSCRIBE_TEXT,
  subscribeSize,
  subscribeUnder,
  underStart,
} from './calendarHeaderRules.ts';

export interface CalendarHeaderStart {
  size: FilterSize;
  language: HeaderLanguage;
  refreshing: HeaderRefreshing;
}

const LINK =
  'https://soirely.app/api/calendar-feeds/pV3kQ8sLm2Xr7TnB0cYw5Hd9JfAe4GuZ1oKi6bRtNqM.ics';
const NEW_LINK =
  'https://soirely.app/api/calendar-feeds/Zt4bWq9Lr2Hk7Vx0Ns5Jd8Fc3Gm6Pa1YuEo4TiRyQwB.ics';
const linkOf = (url: string): CalendarFeedLink => ({
  url,
  webcal: url.replace(/^https:/, 'webcal:'),
});
const TITLE_FRAME = tokens.typeTitleFrameCompact;
const MARK = 16;
const TURN_MS = 800;

/** sc-79265: the Calendar's header on an iPad at a stand-in text size; from AX1 Subscribe leaves the title's row for its own row under it, growing to hold its words. */
export function CalendarHeaderScreen({ start }: { start: CalendarHeaderStart }) {
  const { i18n } = useTranslation();
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { width, height } = useLayout();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [refreshing, setRefreshing] = useState(start.refreshing);
  const [feed, setFeed] = useState(false);
  const subscribeRef = useRef<ViewInstance>(null);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const t = words.t.bind(words);
  const scale = filterScale(size, fontScale);
  const title = frameTitleCap(true, Math.min(width, height), scale);
  const tell = shell.tell;
  const source = useMemo<FeedSource>(
    () => ({
      known: linkOf(LINK),
      read: () => Promise.resolve(linkOf(LINK)),
      reset: async () => linkOf(NEW_LINK),
      openInApp: async () => {
        setFeed(false);
        tell(CW.openApp);
      },
    }),
    [tell],
  );
  const subscribe = () => setFeed(true);

  const controls = (
    <DemoOnly title="Stand-ins for the iPad’s text size, its language and Refreshing…; turn the iPad to see it upright and on its side. The header draws at the size chosen; the frame around it stays at this device’s size. At the standard sizes Subscribe ends the title’s row, as on main. From AX1 to AX5 it moves to its own row under Calendar, its left edge on the title’s, Refreshing… just before it; its label wraps between its words, the pill grows to hold every line, and the words stop at the title’s size. On its side the bell sits under them, as main moves it at these sizes. A phone keeps main’s round button at every size. Tap Subscribe to open the dialog. Nothing is sent and no string is added.">
      <Choices
        heading="Text size"
        options={FILTER_SIZES}
        chosen={size}
        onChoose={setSize}
        id="size"
        prefix="demo.calendarHeader"
      />
      <Choices
        heading="Language"
        options={HEADER_LANGUAGES}
        chosen={language}
        onChoose={setLanguage}
        id="language"
        prefix="demo.calendarHeader"
      />
      <Choices
        heading="Refreshing…"
        options={HEADER_REFRESHING}
        chosen={refreshing}
        onChoose={setRefreshing}
        id="refreshing"
        prefix="demo.calendarHeader"
      />
    </DemoOnly>
  );

  const header =
    shell.layout === 'phone' ? (
      <ListTop
        kind="phone"
        title={t('calendar.title')}
        pill={<OrgPill />}
        bell={<ListTopEnd />}
        beside={<Subscribe phone onPress={subscribe} ref={subscribeRef} />}
      />
    ) : (
      <TabletHeader
        landscape={shell.layout === 'landscape'}
        scale={scale}
        title={title}
        refreshing={refreshing === 'on'}
        onSubscribe={subscribe}
        subscribeRef={subscribeRef}
      />
    );

  const body = (
    <I18nextProvider i18n={words}>
      <ScrollView
        style={styles.grow}
        contentContainerStyle={[
          shell.layout === 'phone'
            ? LIST_EDGES.phone
            : shell.layout === 'portrait'
              ? LIST_EDGES.tabletPortrait
              : LIST_EDGES.tabletLandscape,
          styles.body,
          { paddingBottom: insets.bottom + tokens.space3xl },
        ]}
      >
        {header}
        {controls}
      </ScrollView>
      <CalendarFeed
        open={feed}
        onClose={() => setFeed(false)}
        opener={subscribeRef}
        phone={shell.layout === 'phone'}
        upright={shell.layout === 'portrait'}
        organisationName="QA Organisation"
        source={source}
      />
    </I18nextProvider>
  );

  if (shell.layout === 'landscape')
    return (
      <Landscape column={null} at="Calendar">
        {body}
      </Landscape>
    );

  return (
    <View style={styles.page}>
      {shell.layout === 'portrait' ? (
        <PortraitTop at="Calendar" />
      ) : (
        <View style={{ height: insets.top }} />
      )}
      {body}
    </View>
  );
}

/** The iPad's header at `scale`: the title alone on its row from AX1, Refreshing… and Subscribe on the row under it, and on its side the bell under them. */
function TabletHeader({
  landscape,
  scale,
  title,
  refreshing,
  onSubscribe,
  subscribeRef,
}: {
  landscape: boolean;
  scale: number;
  title: number;
  refreshing: boolean;
  onSubscribe: () => void;
  subscribeRef: Ref<ViewInstance>;
}) {
  const { t } = useTranslation();
  const under = subscribeUnder(scale);
  const titleView = (
    <Text
      size={title}
      weight="bold"
      allowFontScaling={false}
      numberOfLines={1}
      accessibilityRole="header"
      style={[styles.title, { lineHeight: Math.ceil(title * TITLE_FRAME.lineHeight) }]}
      testID="demo.calendarHeader.title"
    >
      {t('calendar.title')}
    </Text>
  );
  const ends = (
    <SubscribeRow
      scale={scale}
      title={title}
      under={under}
      refreshing={refreshing}
      onPress={onSubscribe}
      subscribeRef={subscribeRef}
    />
  );
  const bell = landscape && <ListTopEnd />;

  if (!under)
    return (
      <View style={styles.titleRow}>
        <View style={styles.grow}>{titleView}</View>
        {ends}
        {bell}
      </View>
    );

  return (
    <View style={styles.stacked}>
      <View style={styles.titleAlone}>{titleView}</View>
      {ends}
      {bell}
    </View>
  );
}

/** Refreshing… and Subscribe: at the end of the title's row at the standard sizes; from AX1 a row of their own as wide as the page, the label fitted to the room Refreshing… leaves. */
function SubscribeRow({
  scale,
  title,
  under,
  refreshing,
  onPress,
  subscribeRef,
}: {
  scale: number;
  title: number;
  under: boolean;
  refreshing: boolean;
  onPress: () => void;
  subscribeRef: Ref<ViewInstance>;
}) {
  const { t } = useTranslation();
  const label = t('calendarFeed.open');
  const start = underStart(SUBSCRIBE_TEXT, scale, title);
  const key = `${start}|${label}`;
  const labelWords = wordsIn([label]);
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number> }>({
    key: '',
    widths: {},
  });
  const [rowWidth, setRowWidth] = useState(0);
  const [refreshWidth, setRefreshWidth] = useState(0);
  const widths = measured.key === key ? measured.widths : {};
  const widest = labelWords.every((word) => widths[word] != null)
    ? Math.max(...labelWords.map((word) => widths[word] ?? 0))
    : null;
  const room = rowWidth - (refreshing ? refreshWidth + SUBSCRIBE_GAP : 0);
  const size =
    under && widest != null && rowWidth > 0 ? subscribeSize(scale, title, widest, room) : start;

  return (
    <View
      style={[styles.ends, under && styles.endsUnder]}
      onLayout={(event: LayoutChangeEvent) => setRowWidth(event.nativeEvent.layout.width)}
    >
      {under && (
        <MeasuredWords
          words={labelWords}
          size={start}
          weight="semibold"
          allowFontScaling={false}
          onWidth={(word, width) =>
            setMeasured((now) => {
              const kept = now.key === key ? now.widths : {};

              return kept[word] === width ? now : { key, widths: { ...kept, [word]: width } };
            })
          }
        />
      )}
      {refreshing && (
        <View
          onLayout={(event: LayoutChangeEvent) => setRefreshWidth(event.nativeEvent.layout.width)}
        >
          <StandInRefreshing size={underStart(tokens.typeBody.size, scale, title)} />
        </View>
      )}
      <Pressable
        ref={subscribeRef}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pill,
          under
            ? [
                styles.pillGrown,
                { paddingVertical: grownPad(tokens.sizeHit, SUBSCRIBE_TEXT, SUBSCRIBE_RING) },
              ]
            : styles.pillMain,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID="demo.calendarHeader.subscribe"
      >
        <Glyph
          name="calendar"
          size={under ? (SUBSCRIBE_GLYPH / SUBSCRIBE_TEXT) * size : SUBSCRIBE_GLYPH}
          ink={tokens.colorInk}
          weight={2.1}
        />
        <Text
          size={size}
          weight="semibold"
          allowFontScaling={false}
          numberOfLines={under ? undefined : 1}
          accessible={false}
          style={[styles.label, under && styles.labelGrown]}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

/** Main's Refreshing… at the stand-in size: the 16 mark turning, still under Reduce Motion, and its words. */
function StandInRefreshing({ size }: { size: number }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [turn] = useState(() => new Animated.Value(0));

  useEffect(() => {
    turn.setValue(0);
    if (reduced) return;
    const run = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: TURN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    run.start();

    return () => run.stop();
  }, [reduced, turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.refreshing} testID="demo.calendarHeader.refreshing">
      <Animated.View
        style={{ transform: [{ rotate }] }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width={MARK} height={MARK} viewBox="0 0 16 16" fill="none">
          <Circle
            cx={8}
            cy={8}
            r={6}
            stroke={tokens.colorInkSecondary}
            strokeOpacity={0.3}
            strokeWidth={2}
          />
          <Path
            d="M8 2a6 6 0 0 1 6 6"
            stroke={tokens.colorInkSecondary}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
      <Text size={size} muted allowFontScaling={false} accessibilityRole="text">
        {t('eventsScreen.refreshing')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorCard },
  grow: { flex: 1, minWidth: 0 },
  body: { gap: tokens.space3xl },
  title: { letterSpacing: tracking(TITLE_FRAME), color: tokens.colorInk },
  titleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  titleAlone: { minHeight: 48, justifyContent: 'center', alignSelf: 'stretch' },
  stacked: { alignItems: 'flex-start', gap: tokens.spaceXs },
  ends: { flexDirection: 'row', alignItems: 'center', gap: SUBSCRIBE_GAP },
  endsUnder: { alignSelf: 'stretch' },
  refreshing: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SUBSCRIBE_GAP,
    paddingHorizontal: SUBSCRIBE_SIDE,
    borderWidth: SUBSCRIBE_RING,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorCard,
  },
  pillMain: { height: tokens.sizeHit },
  pillGrown: { flexShrink: 1, minHeight: tokens.sizeHit },
  label: { color: tokens.colorInk },
  labelGrown: { flexShrink: 1, textAlign: 'center' },
  pressed: { opacity: tokens.opacityPressed },
});
