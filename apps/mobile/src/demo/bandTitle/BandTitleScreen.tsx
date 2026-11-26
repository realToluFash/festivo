import { useCallback, useEffect, useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { coverRowSides, pastSides } from '../../components/bodyEdges.ts';
import { Confetti, Cover, type Piece } from '../../components/Cover.tsx';
import { EventMesh } from '../../components/EventMesh.tsx';
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { BellButton, bandBody, OrgButton } from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { Toast } from '../../components/Toast.tsx';
import { TodayShellProvider } from '../../components/todayShell.ts';
import type { Box } from '../../kit/confettiClearance.ts';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
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
import { SearchGlass } from '../SearchGlass.tsx';
import { momentOf, sayIn } from '../today.ts';
import {
  BAND_CLEAR,
  BAND_MOMENTS,
  type BandMoment,
  type BandRow,
  bandLine,
  bandRoom,
  bandStart,
  bandTitle,
} from './bandTitleRules.ts';

/** The phone band's pieces as TodayCover draws them, by share of the band below the status bar. */
const BAND_PIECES: readonly Piece[] = [
  [0.308, 0.357, 'half', 16, 200, 'sun'],
  [0.687, 0.286, 'bar', 22, -30, 'white'],
  [0.769, 0.607, 'half', 14, 30, 'rose'],
];

export interface BandTitleStart {
  size: FilterSize;
  language: FilterLanguage;
  moment: BandMoment;
}

/** sc-92248: Today's scrolled band on a phone, its title whole between the tile and Search at a stand-in text size. */
export function BandTitleScreen({ start }: { start: BandTitleStart }) {
  const { i18n } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [moment, setMoment] = useState(start.moment);
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
              moment={moment}
              language={language}
              top={insets.top}
            />
          </I18nextProvider>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
            <NavBar />
            <View style={styles.page}>
              <DemoOnly title="Stand-ins for the device’s text size, its language and the moment. The band’s title draws at the size chosen; the tile, Search and the bell stay as main draws them at this device’s size. At the standard sizes the band is main’s, its three confetti pieces included on a day with no event. From AX1 the title is one line, whole, at least 8 clear of the tile and of Search: centred on the screen while it fits there, else centred in the room between them, stepped down to the largest size that fits that room and the row’s height, never under its default size, and a piece of confetti within 8 of the title is not drawn, as on the account cards. Nothing is sent and no string is added.">
                <Choices
                  heading="Text size"
                  options={FILTER_SIZES}
                  chosen={size}
                  onChoose={setSize}
                  id="size"
                  prefix="demo.bandTitle"
                />
                <Choices
                  heading="Language"
                  options={FILTER_LANGUAGES}
                  chosen={language}
                  onChoose={setLanguage}
                  id="language"
                  prefix="demo.bandTitle"
                />
                <Choices
                  heading="Moment"
                  options={BAND_MOMENTS}
                  chosen={moment}
                  onChoose={setMoment}
                  id="moment"
                  prefix="demo.bandTitle"
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
  moment,
  language,
  top,
}: {
  scale: number;
  moment: BandMoment;
  language: FilterLanguage;
  top: number;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const drawn = momentOf(moment === 'day' ? 'dayNow' : 'quiet', sayIn(language), t);
  const { now } = drawn;
  const [title, setTitle] = useState<Box | null>(null);

  return (
    <View style={[styles.band, { height: top + bandBody(drawn, 'phone') }]}>
      {now == null ? (
        <>
          <Cover pieces={[]} shade="foot" />
          <View style={[styles.pieces, { top }]}>
            <Confetti
              pieces={BAND_PIECES}
              words={atAccessibilitySizes(scale) ? (title == null ? null : [title]) : undefined}
            />
          </View>
        </>
      ) : (
        <EventMesh event={now.event} shade="day" />
      )}
      <BandRowWithTitle scale={scale} top={top} sides={coverRowSides(insets)} onTitle={setTitle} />
      {now != null && (
        <View style={[styles.bandNow, pastSides(tokens.spaceXl, insets)]}>
          <View style={styles.liveDot} />
          <Text size={13.5} weight="semibold" numberOfLines={1} style={styles.white}>
            {t('todayScreen.liveName', { name: now.name })}
          </Text>
        </View>
      )}
    </View>
  );
}

function BandRowWithTitle({
  scale,
  top,
  sides,
  onTitle,
}: {
  scale: number;
  top: number;
  sides: { paddingLeft: number; paddingRight: number };
  /** The title's box from the band's top row down, once it is drawn at its fitted size. */
  onTitle: (box: Box | null) => void;
}) {
  const { t } = useTranslation();
  const title = t('todayScreen.today');
  const start = bandStart(scale);
  const large = atAccessibilitySizes(scale);
  const [width, setWidth] = useState<number>();
  const [tileEnd, setTileEnd] = useState<number>();
  const [searchStart, setSearchStart] = useState<number>();
  const [measured, setMeasured] = useState<{ key: string; wide: number } | null>(null);
  const key = `${start}|${title}`;
  const wide = measured?.key === key ? measured.wide : undefined;
  const row: BandRow | undefined =
    width == null || tileEnd == null || searchStart == null
      ? undefined
      : { width, tileEnd, searchStart };
  const fitted = row == null || wide == null ? undefined : bandTitle(scale, wide, row);
  // From AX1 the title waits for its room and its width, so no frame draws it under Search.
  const pending = large && fitted == null;
  const drawn = fitted?.size ?? start;
  const inRoom = large && fitted?.centred === 'room' && row != null;
  const [placed, setPlaced] = useState<{ x: number; y: number } | null>(null);
  const [text, setText] = useState<Box | null>(null);

  useEffect(() => {
    onTitle(
      pending || placed == null || text == null
        ? null
        : {
            x: placed.x + text.x,
            y: placed.y + text.y,
            width: text.width,
            height: text.height,
          },
    );
  }, [onTitle, pending, placed, text]);

  return (
    <View
      style={[styles.row, sides, { marginTop: top }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <MeasuredWords
        words={[title]}
        size={start}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(_, measuredWide) =>
          setMeasured((now) =>
            now?.key === key && now.wide === measuredWide ? now : { key, wide: measuredWide },
          )
        }
      />
      <View onLayout={({ nativeEvent: { layout } }) => setTileEnd(layout.x + layout.width)}>
        <OrgButton compact />
      </View>
      <View style={styles.grow} />
      <View onLayout={({ nativeEvent: { layout } }) => setSearchStart(layout.x)}>
        <View style={styles.ends}>
          <SearchGlass />
          <BellButton />
        </View>
      </View>
      <View
        style={[
          styles.title,
          inRoom && { left: row.tileEnd + BAND_CLEAR, right: undefined, width: bandRoom(row) },
        ]}
        pointerEvents="box-none"
        onLayout={({ nativeEvent: { layout } }) => setPlaced({ x: layout.x, y: layout.y })}
      >
        <Text
          key={drawn}
          onLayout={({ nativeEvent: { layout } }) => setText(layout)}
          size={drawn}
          weight="semibold"
          allowFontScaling={false}
          accessibilityRole="header"
          numberOfLines={large ? 1 : undefined}
          style={[
            styles.white,
            large && { lineHeight: bandLine(drawn) },
            pending && styles.waiting,
          ]}
          testID="demo.bandTitle.title"
        >
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colorPage },
  page: { gap: tokens.spaceMd, paddingHorizontal: tokens.spaceXxl, paddingTop: tokens.spaceLg },
  band: { overflow: 'hidden' },
  pieces: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceXxs,
  },
  grow: { flex: 1, minWidth: 0 },
  ends: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  title: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  white: { color: tokens.colorInkOnDark },
  waiting: { opacity: 0 },
  bandNow: {
    position: 'absolute',
    bottom: tokens.spaceLg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceXs,
  },
  liveDot: {
    width: tokens.spaceSm,
    height: tokens.spaceSm,
    borderRadius: tokens.spaceXxs,
    backgroundColor: tokens.colorBroken,
  },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
