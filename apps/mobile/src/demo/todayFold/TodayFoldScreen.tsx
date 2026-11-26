import { type Href, router } from 'expo-router';
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PhoneTabBar,
  SHEET_RISE,
  type Tab,
  TabBarFade,
  tabBarFoot,
} from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { Toast } from '../../components/Toast.tsx';
import { TodayShellProvider } from '../../components/todayShell.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { NavBar } from '../DemoScreen.tsx';
import { demoShell } from '../demoShell.ts';
import { OrgSwitcherProvider } from '../OrgSwitcher.tsx';
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
import { EVENTS, type EventKey } from '../today.ts';
import { FitWords } from '../todaySize/FitWords.tsx';
import { LiveBanner } from '../todaySize/TodaySizeLive.tsx';
import { PillRow } from '../todaySize/TodaySizePill.tsx';
import { liveName } from '../todaySize/todaySizeRules.ts';
import {
  BAND_COMES,
  OPEN_ABOVE_SHEET,
  type Fold,
  foldAt,
  restingPlaces,
  wordsGoFrom,
} from './todayFoldRules.ts';

export interface TodayFoldStart {
  size: FilterSize;
  language: FilterLanguage;
}

const NAME = liveName('dinner') ?? '';
const HEADING = 22;
const ROW = 17;
const BAND_TITLE = 22;
const BAND_LINE = 13;
const ROWS: readonly EventKey[] = ['wed', 'ireti', 'party'];

function toTab(tab: Tab) {
  if (tab === 'Events') router.replace('/demo/events');
  if (tab === 'Calendar') router.replace('/demo/calendar');
  if (tab === 'Settings') router.replace('/demo/settings' as Href);
}

function open(key: EventKey) {
  openEvent(EVENT_OF_KEY[key], openedOver('today'));
}

/** sc-95084: Today on the iPhone with Dîner en direct live, folding as main does, and resting with Open the event whole above the tabs wherever the cover is taller than the screen. */
export function TodayFoldScreen({ start }: { start: TodayFoldStart }) {
  const { i18n } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
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
  const choices = (
    <DemoOnly title="Stand-ins for the device’s text size and its language. Dîner en direct is live, as qa found it, with no venue, no run of show and nobody arrived; the cover, its chips, its name, its end line and Open the event draw as under Today · the greeting and headings whole at the largest text sizes. Today rests in one of three places: open, at its top; folded, the sheet meeting the band, as on main; and, only where Open the event’s foot is lower than the top of the tabs’ fade at the top of the page, between them, scrolled until that foot sits at the top of the fade, so the button is whole above the tabs and clear of the band. A scroll that stops between two of them snaps to the nearer, as main snaps between open and folded; past the fold Today scrolls freely to This week and Your events. Below AX1 the cover fits, so Today rests open and folded only, as on main. The band here is a stand-in for sc-92248’s; its title and live line draw at the size chosen, wrapping only between words. The cover’s words go as Today scrolls up, over main’s 96 before the band comes, but never before the resting place that holds Open the event, so it rests at full ink. Open the event shows a toast here, as the event page has its own design. Nothing is sent and no string is added.">
      <Choices
        heading="Text size"
        options={FILTER_SIZES}
        chosen={size}
        onChoose={setSize}
        id="size"
        prefix="demo.todayFold"
      />
      <Choices
        heading="Language"
        options={FILTER_LANGUAGES}
        chosen={language}
        onChoose={setLanguage}
        id="language"
        prefix="demo.todayFold"
      />
    </DemoOnly>
  );

  return (
    <OrgSwitcherProvider state={null} tell={tell}>
      <TodayShellProvider value={shell}>
        <I18nextProvider i18n={words}>
          <Folding
            key={`${size}-${language}`}
            scale={filterScale(size, fontScale)}
            choices={choices}
          />
        </I18nextProvider>
        {told != null && (
          <View style={styles.toast}>
            <Toast key={told} words={told} onClose={() => setTold(null)} />
          </View>
        )}
      </TodayShellProvider>
    </OrgSwitcherProvider>
  );
}

function Folding({ scale, choices }: { scale: number; choices: ReactNode }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollViewInstance>(null);
  const [offset] = useState(() => new Animated.Value(0));
  const [coverFoot, setCoverFoot] = useState(0);
  const [bandFoot, setBandFoot] = useState(0);
  const [screen, setScreen] = useState(0);
  const [folded, setFolded] = useState(false);
  const fold: Fold = { coverFoot, sheetRise: SHEET_RISE, bandFoot, screen };
  const measured = coverFoot > 0 && bandFoot > 0 && screen > 0;
  const folds = measured ? foldAt(fold) : 0;
  const places = measured ? restingPlaces(fold) : [0];
  const band = offset.interpolate({
    inputRange: [Math.max(0, folds - BAND_COMES), Math.max(1, folds)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const goFrom = measured ? wordsGoFrom(fold) : 0;
  const words = offset.interpolate({
    inputRange: [goFrom, Math.max(goFrom + 1, folds - BAND_COMES)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: offset } } }], {
        useNativeDriver: true,
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) =>
          setFolded(measured && event.nativeEvent.contentOffset.y >= folds - tokens.spaceLg),
      }),
    [offset, folds, measured],
  );
  const tabs = useCallback((tab: Tab) => {
    if (tab === 'Today') scroller.current?.scrollTo({ y: 0, animated: true });
    else toTab(tab);
  }, []);
  const foot = tabBarFoot(insets.bottom);
  const room = width - 2 * tokens.spaceXxl;

  return (
    <View style={styles.page}>
      <Animated.ScrollView
        ref={scroller}
        onLayout={(event) => setScreen(event.nativeEvent.layout.height)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToOffsets={places}
        snapToEnd={false}
        decelerationRate="fast"
        contentContainerStyle={{
          minHeight: screen + folds,
          paddingTop: insets.top,
          paddingBottom: foot + tokens.space6xl + 64,
        }}
        testID="demo.todayFold.page"
      >
        <NavBar />
        <View
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            setCoverFoot(y + height);
          }}
        >
          <LiveBanner
            name={NAME}
            place={null}
            scale={scale}
            top={<PillRow scale={scale} cap={Infinity} waiting={0} />}
            phone
            foot={OPEN_ABOVE_SHEET}
            words={measured ? words : 1}
          />
        </View>
        <View style={styles.sheet}>
          <Heading text={t('todayScreen.thisWeek')} scale={scale} room={room} />
          {ROWS.map((key) => (
            <FitWords
              key={key}
              text={EVENTS[key].name}
              size={ROW}
              scale={scale}
              cap={Infinity}
              room={room}
              weight="semibold"
              line={1.3}
            />
          ))}
          <Heading text={t('todayScreen.yourEvents')} scale={scale} room={room} />
          {ROWS.map((key) => (
            <FitWords
              key={key}
              text={EVENTS[key].name}
              size={ROW}
              scale={scale}
              cap={Infinity}
              room={room}
              weight="medium"
              line={1.3}
            />
          ))}
          {choices}
        </View>
      </Animated.ScrollView>
      <Animated.View
        style={[styles.band, { opacity: band, paddingTop: insets.top }]}
        onLayout={(event) => setBandFoot(event.nativeEvent.layout.height)}
        pointerEvents={folded ? 'auto' : 'none'}
        accessibilityElementsHidden={!folded}
        importantForAccessibility={folded ? 'auto' : 'no-hide-descendants'}
        testID="demo.todayFold.band"
      >
        <FitWords
          text={t('todayScreen.today')}
          size={BAND_TITLE}
          scale={scale}
          cap={Infinity}
          room={room}
          weight="bold"
          line={1.15}
          role="header"
        />
        <FitWords
          text={t('todayScreen.liveName', { name: NAME })}
          size={BAND_LINE}
          scale={scale}
          cap={Infinity}
          room={room}
          weight="semibold"
          line={1.22}
        />
      </Animated.View>
      <TabBarFade />
      <PhoneTabBar bottom={foot} onTab={tabs} />
    </View>
  );
}

function Heading({ text, scale, room }: { text: string; scale: number; room: number }) {
  return (
    <View style={styles.heading}>
      <FitWords
        text={text}
        size={HEADING}
        scale={scale}
        cap={Infinity}
        room={room}
        weight="bold"
        line={1.15}
        role="header"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorCard },
  sheet: {
    marginTop: -SHEET_RISE,
    borderTopLeftRadius: SHEET_RISE,
    borderTopRightRadius: SHEET_RISE,
    backgroundColor: tokens.colorCard,
    paddingTop: OPEN_ABOVE_SHEET,
    paddingHorizontal: tokens.spaceXxl,
    gap: tokens.spaceSm,
  },
  heading: { paddingTop: tokens.spaceXl },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: tokens.colorCard,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceMd,
    gap: tokens.spaceXxs,
  },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl, bottom: 120 },
});
