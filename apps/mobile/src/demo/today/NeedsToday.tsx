import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
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

import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import type { Moment } from '../../kit/today.ts';
import {
  Band,
  bandBody,
  coverBody,
  PhoneTabBar,
  SHEET_RISE,
  type Tab,
  TodayCover,
  TabBarFade,
  tabBarFoot,
} from '../../components/TodayCover.tsx';
import { ThisWeek, YourEvents } from '../../components/TodayParts.tsx';
import { DemoSidebar } from '../Sidebar.tsx';
import { NeedsYou } from './NeedsYou.tsx';

const TAB_BAR = 64;
const BELOW_HEAD = 28;
const WORDS_GO = 96;

/** The product's TodayScreen, with the demo's NeedsYou for the kit's. */
export function NeedsTodayScreen({
  moment,
  onTab,
  notices,
}: {
  moment: Moment;
  onTab: (tab: Tab) => void;
  /** The account's and the organisation's notices, at the top of the page. */
  notices?: ReactNode;
}) {
  const { kind } = useLayout();

  return kind === 'tabletLandscape' ? (
    <Landscape moment={moment} onTab={onTab} notices={notices} />
  ) : (
    <Scrolled moment={moment} onTab={onTab} phone={kind === 'phone'} notices={notices} />
  );
}

function Body({ moment, wide }: { moment: Moment; wide: boolean }) {
  const { width } = useWindowDimensions();

  const below = moment.needs == null ? tokens.spaceXxs : BELOW_HEAD;
  const needs = <NeedsYou moment={moment} wide={wide} top={tokens.spaceXxs} />;

  if (!wide)
    return (
      <>
        {needs}
        <ThisWeek moment={moment} wide={false} top={below} />
        <YourEvents moment={moment} layout="carousel" top={BELOW_HEAD} />
      </>
    );

  // The board's 440 for the week, given up on a narrower iPad so Your events keeps its share.
  const week = Math.min(440, Math.round((width - 2 * BELOW_HEAD - BELOW_HEAD) * 0.58));

  return (
    <>
      {needs}
      <View style={styles.side}>
        <View style={{ width: week }}>
          <ThisWeek moment={moment} wide top={below} />
        </View>
        <View style={styles.grow}>
          <YourEvents moment={moment} layout="list" top={below} />
        </View>
      </View>
    </>
  );
}

function Scrolled({
  moment,
  onTab,
  phone,
  notices,
}: {
  moment: Moment;
  onTab: (tab: Tab) => void;
  phone: boolean;
  notices: ReactNode;
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
  const foot = tabBarFoot(insets.bottom);

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
          <TodayCover moment={moment} layout={layout} top={insets.top} onTab={tabs} words={words} />
        </View>
        <View style={[styles.sheet, phone ? styles.sheetPhone : styles.sheetTablet]}>
          {notices}
          <Body moment={moment} wide={!phone} />
        </View>
      </Animated.ScrollView>
      <Animated.View
        style={[styles.band, { opacity: band }]}
        pointerEvents={folded ? 'box-none' : 'none'}
        accessibilityElementsHidden={!folded}
        importantForAccessibility={folded ? 'auto' : 'no-hide-descendants'}
      >
        <Band moment={moment} layout={layout} top={insets.top} onTab={tabs} />
      </Animated.View>
      {phone && (
        <>
          <TabBarFade />
          <PhoneTabBar bottom={foot} onTab={tabs} />
        </>
      )}
    </View>
  );
}

function Landscape({
  moment,
  onTab,
  notices,
}: {
  moment: Moment;
  onTab: (tab: Tab) => void;
  notices: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const events = moment.events.map(({ event }) => event);
  const below = moment.needs == null ? 0 : BELOW_HEAD;

  return (
    <View style={[styles.chrome, { paddingTop: insets.top }]}>
      <DemoSidebar events={events} onTab={onTab} />
      <View style={[styles.pageCard, { marginBottom: Math.max(insets.bottom, tokens.spaceMd) }]}>
        <ScrollView contentContainerStyle={styles.cardPage} showsVerticalScrollIndicator={false}>
          <TodayCover moment={moment} layout="landscape" top={0} onTab={onTab} />
          {notices}
          <View style={styles.columns}>
            <View style={styles.grow}>
              <NeedsYou moment={moment} wide top={0} />
              <ThisWeek moment={moment} wide top={below} />
            </View>
            <View style={styles.events}>
              <YourEvents moment={moment} layout="list" top={0} />
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space3xl,
    marginTop: tokens.spaceSm,
  },
  events: { width: 316 },
});
