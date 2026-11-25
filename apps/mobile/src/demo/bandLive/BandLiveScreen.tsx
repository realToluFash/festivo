import { useCallback, useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCapsuleLabels } from '../../components/CapsuleLabels.tsx';
import { Cover } from '../../components/Cover.tsx';
import { EventMesh } from '../../components/EventMesh.tsx';
import { Glass } from '../../components/Glass.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import {
  BellButton,
  OrgButton,
  TABS,
  type Tab,
  TabCapsule,
  bandBody,
} from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { Toast } from '../../components/Toast.tsx';
import { TodayShellProvider, useTodayShell } from '../../components/todayShell.ts';
import { CAPSULE_HEIGHT } from '../../layout/capsuleFit.ts';
import { atAccessibilitySizes, wordsIn } from '../../layout/textSize.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { NavBar } from '../DemoScreen.tsx';
import { demoShell } from '../demoShell.ts';
import {
  FILTER_LANGUAGES,
  FILTER_SIZES,
  type FilterLanguage,
  type FilterSize,
  filterScale,
} from '../filterSize/filterSizeRules.ts';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import { OrgSwitcherProvider } from '../OrgSwitcher.tsx';
import { momentOf, sayIn } from '../today.ts';
import {
  CAPSULE_TOP,
  LIVE_DOT,
  LIVE_DOT_GAP,
  LIVE_EVENTS,
  LIVE_FOOT,
  LIVE_GAP,
  LIVE_LINE,
  LIVE_SIDES,
  type LiveEvent,
  liveEventName,
  liveLine,
  liveLineHeight,
  liveRoom,
} from './bandLiveRules.ts';

const UPRIGHT_ONLY =
  'This page is the upright iPad’s band: hold an iPad upright to see it as the board draws it. The phone’s band is sc-92248’s, and on its side Today has a banner, not a band. ';

export interface BandLiveStart {
  size: FilterSize;
  language: FilterLanguage;
  event: LiveEvent;
}

/** sc-92315: Today's scrolled band on an upright iPad, its live line whole under the tabs at a stand-in text size. */
export function BandLiveScreen({ start }: { start: BandLiveStart }) {
  const { i18n } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [event, setEvent] = useState(start.event);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const [told, setTold] = useState<string | null>(null);
  const tell = useCallback<Tell>((said) => setTold(said), []);
  const shell = useMemo(() => demoShell(tell), [tell]);

  return (
    <OrgSwitcherProvider state={null} tell={tell}>
      <TodayShellProvider value={shell}>
        <View style={styles.screen}>
          <I18nextProvider i18n={words}>
            <Band
              scale={filterScale(size, fontScale)}
              event={event}
              language={language}
              top={insets.top}
              onTab={(tab) => tell(`${tab} opens, as on main.`)}
            />
          </I18nextProvider>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
            <NavBar />
            <View style={styles.page}>
              <DemoOnly
                title={`${kind === 'tabletPortrait' ? '' : UPRIGHT_ONLY}Stand-ins for the device’s text size, its language and the live event’s name. The live line draws at the size chosen; the tile, the tabs, Search and the bell stay as main draws them at this device’s size. At the standard sizes the band is main’s: 92 under the status bar, the line on one line. From AX1 the line sits 10 under the tab capsule and 12 above the band’s foot, the band growing down to hold it; it wraps only between words, steps down only as far as its widest word needs, never under 13.5, and a word too wide even at 13.5 breaks at the line’s end. The page scrolls on under the band. Nothing is sent and no string is added.`}
              >
                <Choices
                  heading="Text size"
                  options={FILTER_SIZES}
                  chosen={size}
                  onChoose={setSize}
                  id="size"
                  prefix="demo.bandLive"
                />
                <Choices
                  heading="Language"
                  options={FILTER_LANGUAGES}
                  chosen={language}
                  onChoose={setLanguage}
                  id="language"
                  prefix="demo.bandLive"
                />
                <Choices
                  heading="The live event"
                  options={LIVE_EVENTS}
                  chosen={event}
                  onChoose={setEvent}
                  id="event"
                  prefix="demo.bandLive"
                />
              </DemoOnly>
            </View>
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

function Band({
  scale,
  event,
  language,
  top,
  onTab,
}: {
  scale: number;
  event: LiveEvent;
  language: FilterLanguage;
  top: number;
  onTab: (tab: Tab) => void;
}) {
  const { t } = useTranslation();
  const drawn = momentOf(event === 'none' ? 'quiet' : 'dayNow', sayIn(language), t);
  const { now } = drawn;
  const said =
    now == null || event === 'none'
      ? null
      : t('todayScreen.liveName', { name: liveEventName(event) });
  const [width, setWidth] = useState<number>();
  const [row, setRow] = useState<number>();
  const [end, setEnd] = useState<number>();
  const labels = TABS.map(([, glyph]) => t(`todayScreen.tab.${glyph}`));
  const { labelSize, measure } = useCapsuleLabels(
    labels,
    row == null ? 0 : Math.max(0, row - 2 * tokens.space3xl),
    end,
  );

  return (
    <View
      style={[styles.band, { minHeight: top + bandBody(drawn, 'portrait') }]}
      onLayout={(layout) => setWidth(layout.nativeEvent.layout.width)}
    >
      {now == null ? (
        <Cover pieces={[]} shade="foot" />
      ) : (
        <EventMesh event={now.event} shade="day" />
      )}
      <View style={[styles.capsuleRoom, { marginTop: top }]}>
        <View style={styles.row} onLayout={(layout) => setRow(layout.nativeEvent.layout.width)}>
          {measure}
          <OrgButton compact />
          <View style={styles.grow} />
          <View style={styles.ends} onLayout={(layout) => setEnd(layout.nativeEvent.layout.width)}>
            <SearchGlass />
            <BellButton />
          </View>
          <View style={styles.capsuleAt} pointerEvents="box-none">
            <View key={labelSize}>
              {labelSize != null && <TabCapsule onTab={onTab} labelSize={labelSize} />}
            </View>
          </View>
        </View>
      </View>
      {said != null && <LiveLine scale={scale} said={said} width={width} />}
    </View>
  );
}

function LiveLine({
  scale,
  said,
  width,
}: {
  scale: number;
  said: string;
  width: number | undefined;
}) {
  const start = LIVE_LINE * scale;
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  const words = wordsIn([said]);
  const key = (word: string) => `${start}|${word}`;
  const measured = words.map((word) => widths[key(word)]);
  const widest = measured.every((wide) => wide != null) ? Math.max(...measured.map(Number)) : null;

  if (!atAccessibilitySizes(scale))
    return (
      <View style={styles.mainLine}>
        <View style={styles.liveDot} />
        <Text
          size={start}
          weight="semibold"
          allowFontScaling={false}
          numberOfLines={1}
          style={styles.white}
          testID="demo.bandLive.line"
        >
          {said}
        </Text>
      </View>
    );

  const fitted = widest == null || width == null ? null : liveLine(scale, widest, liveRoom(width));
  const size = fitted?.size ?? start;
  const line = liveLineHeight(size);

  return (
    <View style={styles.grownLine}>
      <MeasuredWords
        words={words}
        size={start}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(word, wide) =>
          setWidths((now) => (now[key(word)] === wide ? now : { ...now, [key(word)]: wide }))
        }
      />
      <View style={[styles.liveDot, { marginTop: (line - LIVE_DOT) / 2 }]} />
      <Text
        key={size}
        size={size}
        weight="semibold"
        allowFontScaling={false}
        style={[
          styles.white,
          styles.shrink,
          { lineHeight: line },
          fitted == null && styles.waiting,
        ]}
        testID="demo.bandLive.line"
      >
        {said}
      </Text>
    </View>
  );
}

/** Search in glass, the bell's twin, as the product's band draws it. */
function SearchGlass() {
  const { t } = useTranslation();
  const { open } = useTodayShell();

  return (
    <Pressable
      onPress={() => open({ to: 'search' })}
      accessibilityRole="button"
      accessibilityLabel={t('search.row')}
      hitSlop={tokens.spaceXxs}
    >
      <Glass style={styles.glass}>
        <Glyph name="search" size={19} ink={tokens.colorInkOnDark} />
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colorPage },
  page: { gap: tokens.spaceMd, paddingHorizontal: tokens.spaceXxl, paddingTop: tokens.spaceLg },
  band: { overflow: 'hidden' },
  capsuleRoom: { minHeight: CAPSULE_TOP + CAPSULE_HEIGHT },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: tokens.spaceMd,
    paddingHorizontal: tokens.space3xl,
  },
  grow: { flex: 1, minWidth: 0 },
  ends: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  glass: { width: 40, justifyContent: 'center' },
  capsuleAt: { position: 'absolute', left: 0, right: 0, top: CAPSULE_TOP, alignItems: 'center' },
  white: { color: tokens.colorInkOnDark },
  shrink: { flexShrink: 1 },
  waiting: { opacity: 0 },
  mainLine: {
    position: 'absolute',
    left: LIVE_SIDES,
    right: LIVE_SIDES,
    bottom: LIVE_FOOT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LIVE_DOT_GAP,
  },
  grownLine: {
    alignSelf: 'center',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LIVE_DOT_GAP,
    marginTop: LIVE_GAP,
    marginBottom: LIVE_FOOT,
    paddingHorizontal: LIVE_SIDES,
  },
  liveDot: {
    width: LIVE_DOT,
    height: LIVE_DOT,
    borderRadius: tokens.spaceXxs,
    backgroundColor: tokens.colorBroken,
  },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
