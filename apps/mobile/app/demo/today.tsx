import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Toast } from '../../src/components/Toast.tsx';
import { useSystemBack } from '../../src/components/useSystemBack.ts';
import { useLayout } from '../../src/layout/useLayout.ts';
import { MOMENTS, type Moment, type MomentName, momentOf, sayIn } from '../../src/demo/today.ts';
import {
  Band,
  bandBody,
  coverBody,
  PhoneTabBar,
  SHEET_RISE,
  type Tab,
  TodayCover,
} from '../../src/demo/TodayCover.tsx';
import { FirstRun, NeedsYou, type Tell, ThisWeek, YourEvents } from '../../src/demo/TodayParts.tsx';
import { TodaySidebar } from '../../src/demo/TodaySidebar.tsx';
import { openEvent } from '../../src/demo/events/EventsList.tsx';
import { EVENT_OF_KEY } from '../../src/demo/events/EventsSample.ts';
import { useCoverStatusBar } from '../../src/demo/Welcome.tsx';
import { tokens } from '../../src/theme/tokens.ts';

const TAB_BAR = 64;
const BELOW_HEAD = 28;
const WORDS_GO = 96;

function toEvents() {
  router.replace('/demo/events');
}

function isMoment(name: string | undefined): name is MomentName {
  return MOMENTS.some((moment) => moment === name);
}

export default function DemoTodayScreen() {
  const params = useLocalSearchParams<{ moment?: string; toast?: string }>();
  const name = isMoment(params.moment) ? params.moment : 'plan';
  // The demo's words are English, so its dates are too, in the phone's own region.
  const moment = useMemo(
    () => momentOf(name, sayIn(formattingLocale('en', getLocales()[0]?.languageTag))),
    [name],
  );
  const { kind } = useLayout();
  const [told, setTold] = useState(params.toast);
  const tell = useCallback<Tell>((words) => setTold(words), []);
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
  useCoverStatusBar(kind === 'tabletLandscape' ? 'dark' : 'light', false);

  const onTab = useCallback(
    (tab: Tab) => {
      if (tab === 'Settings') router.replace('/demo/settings');
      else if (tab === 'Events') toEvents();
      else if (tab !== 'Today') tell(`${tab} has its own design.`);
    },
    [tell],
  );

  const layout =
    kind === 'tabletLandscape' ? (
      <Landscape moment={moment} tell={tell} onTab={onTab} />
    ) : (
      <Scrolled moment={moment} tell={tell} onTab={onTab} phone={kind === 'phone'} />
    );

  return (
    <View style={styles.fill}>
      {layout}
      {told != null && (
        <Told words={told} phone={kind === 'phone'} onClose={() => setTold(undefined)} />
      )}
    </View>
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

function Body({ moment, wide, tell }: { moment: Moment; wide: boolean; tell: Tell }) {
  const { width } = useWindowDimensions();

  if (moment.kind === 'first') return <FirstRun wide={wide} tell={tell} />;

  const below = moment.needs == null ? tokens.spaceXxs : BELOW_HEAD;
  const needs = <NeedsYou moment={moment} wide={wide} top={tokens.spaceXxs} tell={tell} />;

  if (!wide)
    return (
      <>
        {needs}
        <ThisWeek moment={moment} wide={false} top={below} tell={tell} />
        <YourEvents
          moment={moment}
          layout="carousel"
          top={BELOW_HEAD}
          tell={tell}
          onAll={toEvents}
        />
      </>
    );

  // The board's 440 for the week, given up on a narrower iPad so Your events keeps its share.
  const week = Math.min(440, Math.round((width - 2 * BELOW_HEAD - BELOW_HEAD) * 0.58));

  return (
    <>
      {needs}
      <View style={styles.side}>
        <View style={{ width: week }}>
          <ThisWeek moment={moment} wide top={below} tell={tell} />
        </View>
        <View style={styles.grow}>
          <YourEvents moment={moment} layout="list" top={below} tell={tell} onAll={toEvents} />
        </View>
      </View>
    </>
  );
}

function Scrolled({
  moment,
  tell,
  onTab,
  phone,
}: {
  moment: Moment;
  tell: Tell;
  onTab: (tab: Tab) => void;
  phone: boolean;
}) {
  const insets = useSafeAreaInsets();
  const layout = phone ? 'phone' : 'portrait';
  const [offset] = useState(() => new Animated.Value(0));
  const [folded, setFolded] = useState(false);
  const scroller = useRef<ScrollViewInstance>(null);
  // The cover grows past the board's height when its words wrap, so the fold follows what it measures.
  const [body, setBody] = useState(() => coverBody(moment, layout));
  const foldAt = body - bandBody(moment, layout) - SHEET_RISE;
  const bandFrom = foldAt - tokens.space3xl;
  const band = offset.interpolate({
    inputRange: [bandFrom, foldAt],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  // The words are gone before the band comes, so the two never show through each other.
  const words = offset.interpolate({
    inputRange: [Math.max(0, bandFrom - WORDS_GO), bandFrom],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const { height } = useWindowDimensions();
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: offset } } }], {
        useNativeDriver: true,
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) =>
          setFolded(event.nativeEvent.contentOffset.y >= foldAt - tokens.spaceLg),
      }),
    [offset, foldAt],
  );
  const tabs = useCallback(
    (tab: Tab) => {
      if (tab === 'Today') scroller.current?.scrollTo({ y: 0, animated: true });
      else onTab(tab);
    },
    [onTab],
  );
  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);

  return (
    <View style={styles.page}>
      {/* Like a large title, the cover is open or folded: a scroll that stops between snaps to one, and a short page still has the room to fold. */}
      <Animated.ScrollView
        ref={scroller}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToOffsets={[0, foldAt]}
        snapToEnd={false}
        contentContainerStyle={{
          minHeight: height + foldAt,
          paddingBottom: phone ? foot + TAB_BAR + tokens.space6xl : insets.bottom + tokens.space6xl,
        }}
      >
        <View onLayout={(event) => setBody(event.nativeEvent.layout.height - insets.top)}>
          <TodayCover
            moment={moment}
            layout={layout}
            top={insets.top}
            tell={tell}
            onTab={tabs}
            words={words}
          />
        </View>
        <View style={[styles.sheet, phone ? styles.sheetPhone : styles.sheetTablet]}>
          <Body moment={moment} wide={!phone} tell={tell} />
        </View>
      </Animated.ScrollView>
      <Animated.View
        style={[styles.band, { opacity: band }]}
        pointerEvents={folded ? 'box-none' : 'none'}
        accessibilityElementsHidden={!folded}
        importantForAccessibility={folded ? 'auto' : 'no-hide-descendants'}
      >
        <Band moment={moment} layout={layout} top={insets.top} tell={tell} onTab={tabs} />
      </Animated.View>
      {phone && (
        <>
          <Fade />
          <PhoneTabBar bottom={foot} onTab={tabs} />
        </>
      )}
    </View>
  );
}

function Fade() {
  return (
    <View style={styles.fade} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="todayFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tokens.colorCard} stopOpacity={0} />
            <Stop offset="0.62" stopColor={tokens.colorCard} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#todayFade)" />
      </Svg>
    </View>
  );
}

function Landscape({
  moment,
  tell,
  onTab,
}: {
  moment: Moment;
  tell: Tell;
  onTab: (tab: Tab) => void;
}) {
  const insets = useSafeAreaInsets();
  const events = moment.events.map(({ event }) => event);
  const below = moment.needs == null ? 0 : BELOW_HEAD;

  return (
    <View style={[styles.chrome, { paddingTop: insets.top }]}>
      <TodaySidebar
        events={events}
        onTab={onTab}
        tell={tell}
        onEvent={(key) => openEvent(EVENT_OF_KEY[key])}
      />
      <View style={[styles.pageCard, { marginBottom: Math.max(insets.bottom, tokens.spaceMd) }]}>
        <ScrollView contentContainerStyle={styles.cardPage} showsVerticalScrollIndicator={false}>
          <TodayCover moment={moment} layout="landscape" top={0} tell={tell} onTab={onTab} />
          {moment.kind === 'first' ? (
            <View style={styles.firstPad}>
              <FirstRun wide tell={tell} />
            </View>
          ) : (
            <View style={styles.columns}>
              <View style={styles.grow}>
                <NeedsYou moment={moment} wide top={0} tell={tell} />
                <ThisWeek moment={moment} wide top={below} tell={tell} />
              </View>
              <View style={styles.events}>
                <YourEvents moment={moment} layout="list" top={0} tell={tell} onAll={toEvents} />
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  sheet: {
    marginTop: -SHEET_RISE,
    borderTopLeftRadius: SHEET_RISE,
    borderTopRightRadius: SHEET_RISE,
    backgroundColor: tokens.colorCard,
  },
  sheetPhone: { paddingTop: 22, paddingHorizontal: tokens.spaceXxl },
  sheetTablet: { paddingTop: 26, paddingHorizontal: BELOW_HEAD },
  side: { flexDirection: 'row', alignItems: 'flex-start', gap: BELOW_HEAD },
  band: { position: 'absolute', left: 0, right: 0, top: 0 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
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
    gap: 18,
  },
  firstPad: { paddingTop: tokens.spaceSm },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space3xl,
    marginTop: tokens.spaceSm,
  },
  events: { width: 316 },
});
