import { type Ref, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  PixelRatio,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import {
  TAB_BAR_BORDER,
  coverRowSides,
  pastSides,
  sidePadding,
  tabBarFit,
  tabWidth,
} from './bodyEdges.ts';
import { BandLiveLine } from './BandLiveLine.tsx';
import { Text, TitleCap } from './Text.tsx';
import { CappedWholeWords, MeasuredWords, useMeasuredAt } from './Title.tsx';
import {
  BAND_CLEAR,
  BAND_TITLE,
  type BandRow,
  bandLine,
  bandLiveRoom,
  bandLiveSize,
  bandRoom,
  bandStart,
  bandTitle,
} from '../layout/bandTitle.ts';
import { TAB_LABEL, eventBarLabelSize, tabLabelStart } from '../layout/tabLabel.ts';
import {
  atAccessibilitySizes,
  capUnderTitle,
  fitWidest,
  labelStart,
  wholeLineHeight,
  wordsIn,
} from '../layout/textSize.ts';
import { CAPSULE_HEIGHT, CAPSULE_LABEL, openerRoom } from '../layout/capsuleFit.ts';
import { CAPSULE_TOP, LIVE_FOOT, liveLineHeight } from '../layout/bandLive.ts';
import { OPEN_ABOVE_SHEET, TAB_FADE } from '../layout/todayFold.ts';
import { capsuleLabelMultiplier, useCapsuleLabels } from './CapsuleLabels.tsx';
import {
  FIGURE_LABEL,
  FIGURE_LABEL_LINE,
  FIGURE_NUMBERS,
  FIGURE_NUMBERS_LINE,
  FIGURE_RING,
  figureRing,
  figureRoom,
  figureStroke,
} from '../layout/arrivedFigure.ts';
import { tokens } from '../theme/tokens.ts';
import { Confetti, Cover, type Piece } from './Cover.tsx';
import { EventMesh } from './EventMesh.tsx';
import { Glass } from './Glass.tsx';
import { Glyph, type GlyphName } from './Glyph.tsx';
import type { Box } from '../kit/confettiClearance.ts';
import type { ArrivedFigure as Figure, Moment, Now } from '../kit/today.ts';
import { useAccessibilitySizes, useLayout, useNameLines } from '../layout/useLayout.ts';
import { OrgMark } from './OrgMark.tsx';
import {
  Chips,
  CoverLine,
  RunNowBlock,
  WhiteButton,
  WholeChips,
  WholeWhiteButton,
} from './TodayRun.tsx';
import { OPENER, OpenerWords, WholeOpenerWords, quietTap, useWholeTile } from './OrgPill.tsx';
import { usePlainBell, useTodayShell } from './todayShell.ts';
import { usePillFit } from './usePillFit.tsx';
import { phoneNameRoom, rowMeasured, uprightNameRoom } from '../layout/pillFit.ts';

export type CoverLayout = 'phone' | 'portrait' | 'landscape';

export { Glass };

export const SHEET_RISE = tokens.space4xl;

/** The cover's height under the status bar, from the board: taller on the day, when it is Now. */
export function coverBody(moment: Moment, layout: CoverLayout): number {
  const day = moment.kind === 'day';
  const full = moment.full || moment.run != null;

  if (layout === 'phone') return day ? (full ? 514 : 376) : 262;
  if (layout === 'portrait') return day ? (full ? 530 : 410) : 350;

  return day ? (full ? 330 : 236) : 200;
}

export function bandBody(moment: Moment, layout: CoverLayout): number {
  const day = moment.kind === 'day';

  return layout === 'phone' ? (day ? 84 : 56) : day ? 92 : 62;
}

/** The least room between the top row and the words at the foot: on Soirely's cover, the band the confetti flies in. */
function footClear(moment: Moment, phone: boolean): number {
  if (moment.kind === 'day') return tokens.spaceXl;

  return phone ? 52 : 122;
}

// Placed by share of the cover's height on the board, under the status bar, so they keep clear of the greeting at the foot.
const PHONE_PIECES: readonly Piece[] = [
  [0.544, 0.076, 'bar', 30, 24, 'white'],
  [0.733, 0.122, 'half', 18, 200, 'sun'],
  [0.149, 0.26, 'half', 34, -18, 'sun'],
  [0.385, 0.275, 'bar', 26, 62, 'rose'],
  [0.631, 0.29, 'half', 22, 32, 'white'],
  [0.867, 0.244, 'bar', 34, -40, 'sun'],
  [0.99, 0.542, 'half', 26, -70, 'rose'],
  [0.01, 0.366, 'bar', 24, -30, 'white'],
];
const PORTRAIT_PIECES: readonly Piece[] = [
  [0.3, 0.251, 'half', 40, -18, 'sun'],
  [0.743, 0.234, 'bar', 44, 24, 'white'],
  [0.839, 0.309, 'half', 22, 200, 'sky'],
  [0.947, 0.434, 'half', 32, 32, 'rose'],
  [0.144, 0.343, 'bar', 34, 62, 'rose'],
  [0.504, 0.343, 'half', 20, 150, 'white'],
  [0.978, 0.68, 'bar', 40, -40, 'sun'],
  [0.019, 0.417, 'half', 30, 150, 'white'],
];
const BANNER_PIECES: readonly Piece[] = [
  [0.633, 0.13, 'half', 30, -18, 'sun'],
  [0.724, 0.35, 'bar', 34, 24, 'white'],
  [0.814, 0.17, 'half', 18, 200, 'sky'],
  [0.894, 0.55, 'bar', 30, -40, 'rose'],
  [0.962, 0.3, 'half', 24, 32, 'white'],
  [0.66, 0.72, 'bar', 22, 62, 'rose'],
  [0.984, 0.8, 'half', 26, 150, 'sun'],
];
const BAND_PIECES: readonly Piece[] = [
  [0.308, 0.357, 'half', 16, 200, 'sun'],
  [0.687, 0.286, 'bar', 22, -30, 'white'],
  [0.769, 0.607, 'half', 14, 30, 'rose'],
];
// The iPad's band holds the tabs at its middle, so its pieces keep to either side of them.
const TABLET_BAND_PIECES: readonly Piece[] = [
  [0.17, 0.4, 'half', 16, 200, 'sun'],
  [0.8, 0.3, 'bar', 22, -30, 'white'],
  [0.86, 0.64, 'half', 14, 30, 'rose'],
];

export const TABS = [
  ['Today', 'today'],
  ['Events', 'events'],
  ['Calendar', 'calendar'],
  ['Settings', 'settings'],
] as const;

export type Tab = (typeof TABS)[number][0];

/** The ways out that the Maestro flows open Settings and the switcher by, from the signed-in home before Today too. */
export const SETTINGS_ID: Partial<Record<Tab, string>> = { Settings: 'home.openSettings' };

/** The switcher's opener in glass: the tile alone on the band, the tile, the name and what waits on the cover. */
export function OrgButton({
  compact = false,
  maxWidth,
  givesWay = false,
  nameRoom,
}: {
  compact?: boolean;
  /** The most it may take, so it stops short of what sits beside it. */
  maxWidth?: number | undefined;
  /** The tabs beside it took their room first, so it is its tile (sc-40401). */
  givesWay?: boolean;
  /** On the cover from AX1, the name's line, 0 until the row is measured (sc-92247, sc-92314). */
  nameRoom?: number | undefined;
}) {
  const ref = useRef<ViewInstance>(null);
  const org = useTodayShell().useOrgOpener(ref, !compact);
  const phone = useLayout().kind === 'phone';
  const large = useAccessibilitySizes();
  const lines = useNameLines();
  const { tileAlone, measure } = usePillFit(org.name, org.waiting, maxWidth, large);
  const whole = large && !compact && nameRoom != null;
  const fit = useWholeTile(org.name, org.waiting, whole ? nameRoom : undefined);
  const shared = {
    ref,
    onPress: org.onPress,
    accessibilityRole: 'button',
    accessibilityLabel: org.label,
    accessibilityState: { expanded: org.expanded },
    ...quietTap(org.onPress, org.expanded),
    hitSlop: tokens.spaceXxs,
    testID: 'home.switchOrganisation',
  } as const;

  const tile = (
    <Pressable {...shared}>
      <Glass style={styles.orgCompact}>
        <OrgMark id={org.id} name={org.name} side={30} glass />
      </Glass>
      {org.waiting != null && <View style={styles.tileRing} />}
    </Pressable>
  );

  if (compact) return tile;

  const tall = org.waiting != null ? OPENER.waiting : 40;
  // Clear of the bell by the cover's side margin; the phone's row already sets a gap either side of its spacer.
  const clear = phone ? tokens.spaceXl - 2 * tokens.spaceSm : tokens.space3xl;
  const wrap = phone || large;

  if (tileAlone || givesWay || fit.tileAlone)
    return (
      <View style={[styles.orgFit, { marginRight: clear, maxWidth }]}>
        {measure}
        {fit.measure}
        {tile}
      </View>
    );

  return (
    <View style={[styles.orgFit, { marginRight: clear, maxWidth }]}>
      {measure}
      {fit.measure}
      <Pressable {...shared} style={styles.orgWide}>
        <Glass height={tall} style={[styles.orgGlass, { height: undefined, minHeight: tall }]}>
          <OrgMark id={org.id} name={org.name} side={28} glass />
          {whole ? (
            <WholeOpenerWords
              name={org.name}
              waiting={org.waiting}
              room={nameRoom ?? 0}
              hidden={!fit.known || !nameRoom}
              onDark
            />
          ) : (
            <OpenerWords
              name={org.name}
              waiting={org.waiting}
              onDark
              wrap={wrap}
              lines={wrap ? undefined : lines}
            />
          )}
          <Glyph name="updown" size={14} ink={tokens.colorInkOnDark} />
        </Glass>
      </Pressable>
    </View>
  );
}

/** The phone cover's top row: the pill, then Search and the bell, the pill's line measured from the row from AX1 and its name capped under the greeting (sc-92247). */
function PhoneTop({ top, greeting }: { top: number; greeting: number | null }) {
  const insets = useSafeAreaInsets();
  const sides = coverRowSides(insets);
  const large = useAccessibilitySizes();
  const [row, setRow] = useState(0);
  const [ends, setEnds] = useState(0);
  const inside = row - sides.paddingLeft - sides.paddingRight;

  return (
    <View
      style={[styles.topPhone, sides, { marginTop: top }]}
      onLayout={(event) => setRow(event.nativeEvent.layout.width)}
    >
      <TitleCap.Provider value={greeting}>
        <OrgButton
          nameRoom={large ? (rowMeasured(row, ends) ? phoneNameRoom(inside, ends) : 0) : undefined}
        />
      </TitleCap.Provider>
      <View style={styles.grow} />
      <View onLayout={(event) => setEnds(event.nativeEvent.layout.width)}>
        <SearchAndBell />
      </View>
    </View>
  );
}

export function BellButton() {
  const { t } = useTranslation();
  const { unread, open, useBell = usePlainBell } = useTodayShell();
  const bell = useBell(() => open({ to: 'notifications' }));
  const { ref: bellRef, open: openBell, popover } = bell;

  return (
    <>
      <Pressable
        ref={bellRef}
        onPress={openBell}
        accessibilityRole="button"
        accessibilityLabel={
          unread > 0
            ? t('todayScreen.notificationsUnread', { count: unread })
            : t('todayScreen.notifications')
        }
        hitSlop={tokens.spaceXxs}
      >
        <Glass style={styles.bell}>
          <Glyph name="bell" size={19} ink={tokens.colorInkOnDark} />
          {unread > 0 && <View style={styles.unread} />}
        </Glass>
      </Pressable>
      {popover}
    </>
  );
}

/** Search in glass, the bell's twin: drawn 40, tapped 48 (sc-39534). */
function SearchGlass() {
  const { t } = useTranslation();
  const { open } = useTodayShell();

  return (
    <Pressable
      onPress={() => open({ to: 'search' })}
      accessibilityRole="button"
      accessibilityLabel={t('search.row')}
      hitSlop={tokens.spaceXxs}
      testID="today.search"
    >
      <Glass style={styles.bell}>
        <Glyph name="search" size={19} ink={tokens.colorInkOnDark} />
      </Glass>
    </Pressable>
  );
}

/** The right end of the phone's and the upright iPad's top: Search, then the bell. */
function SearchAndBell() {
  const { search } = useTodayShell();

  if (!search) return <BellButton />;

  return (
    <View style={styles.ends}>
      <SearchGlass />
      <BellButton />
    </View>
  );
}

/** iPadOS 26's tab bar, in glass at the top of the cover. */
export function TabCapsule({
  onTab,
  at = 'Today',
  labelSize,
}: {
  onTab: (tab: Tab) => void;
  at?: Tab;
  /** The one size its labels are drawn at, where the row it sits in chooses it (sc-40401). */
  labelSize?: number | undefined;
}) {
  const { t } = useTranslation();

  return (
    <Glass height={CAPSULE_HEIGHT} grows style={styles.capsule}>
      {TABS.map(([label, glyph]) => {
        const on = label === at;
        const ink = on ? tokens.colorAccent : tokens.colorInkOnDark;

        return (
          <Pressable
            key={label}
            onPress={() => onTab(label)}
            style={[styles.capsuleTab, on && styles.capsuleOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t(`todayScreen.tab.${glyph}`)}
            testID={SETTINGS_ID[label] ?? `tab-${label.toLowerCase()}`}
          >
            <Glyph name={glyph} ink={ink} />
            <Text
              size={CAPSULE_LABEL}
              weight="semibold"
              maxFontSizeMultiplier={capsuleLabelMultiplier(labelSize)}
              numberOfLines={labelSize == null ? undefined : 1}
              wholeLines
              accessible={false}
              style={{ color: ink }}
            >
              {t(`todayScreen.tab.${glyph}`)}
            </Text>
          </Pressable>
        );
      })}
    </Glass>
  );
}

export function Greeting({
  moment,
  size,
  sub,
  gap,
  onDrawn,
}: {
  moment: Moment;
  size: number;
  sub: number;
  gap: number;
  onDrawn?: ((size: number | null) => void) | undefined;
}) {
  const whole = useAccessibilitySizes();
  const [room, setRoom] = useState(0);
  const [drawn, setDrawn] = useState<number | null>(null);
  const subCap = whole && drawn != null ? capUnderTitle(drawn, sub) : undefined;
  const look = {
    weight: 'bold',
    accessibilityRole: 'header',
    style: [styles.white, { letterSpacing: size * -0.02 }],
  } as const;

  useEffect(() => {
    onDrawn?.(whole ? drawn : null);
  }, [onDrawn, whole, drawn]);
  useEffect(() => () => onDrawn?.(null), [onDrawn]);

  // From AX1 the greeting steps down rather than break a word, and its comma stays on the word before it (sc-91291).
  return (
    <View style={{ gap }}>
      <Text size={12} weight="semibold" style={[styles.white, styles.eyebrow]}>
        {moment.eyebrow.toUpperCase()}
      </Text>
      {whole ? (
        <View onLayout={(event) => setRoom(event.nativeEvent.layout.width)}>
          <CappedWholeWords
            {...look}
            size={size}
            room={room}
            breakAfterHyphens
            onDrawn={setDrawn}
            style={[
              look.style,
              drawn != null && { lineHeight: wholeLineHeight(size, drawn, 1.08) },
            ]}
          >
            {moment.hello}
          </CappedWholeWords>
        </View>
      ) : (
        <Text {...look} size={size} style={[look.style, { lineHeight: Math.round(size * 1.08) }]}>
          {moment.hello}
        </Text>
      )}
      <View style={styles.subLine}>
        {moment.lead != null && (
          <Text
            size={sub}
            weight="bold"
            maxFontSizeMultiplier={subCap}
            style={[styles.white, { lineHeight: sub * 1.45 }]}
          >
            {`${moment.lead} `}
          </Text>
        )}
        <Text
          size={sub}
          weight="medium"
          maxFontSizeMultiplier={subCap}
          style={[styles.white, { lineHeight: sub * 1.45 }]}
        >
          {moment.sub}
        </Text>
      </View>
    </View>
  );
}

function Rail({ now }: { now: Now }) {
  const last = now.rail.length - 1;

  return (
    <View
      style={styles.rail}
      accessible
      accessibilityLabel={now.rail.map((stop) => `${stop.time} ${stop.name}`).join(', ')}
    >
      <View style={styles.railLine}>
        <View style={[styles.railTrack, styles.railFaint]} />
        <View style={[styles.railTrack, { width: `${now.at * 100}%` }]} />
        {now.rail.map((stop, index) =>
          stop.state === 'now' ? null : (
            <View
              key={stop.time}
              style={[
                styles.node,
                { left: `${(index / last) * 100}%` },
                stop.state === 'done' ? styles.nodeDone : styles.nodeLater,
              ]}
            />
          ),
        )}
        <View style={[styles.nowGlow, { left: `${now.at * 100}%` }]} />
        <View style={[styles.nowNode, { left: `${now.at * 100}%` }]} />
      </View>
      <View style={styles.railLabels}>
        {now.rail.map((stop, index) => (
          <Text
            key={stop.time}
            size={12}
            weight={stop.state === 'now' || stop.state === 'next' ? 'semibold' : 'medium'}
            accessible={false}
            numberOfLines={1}
            style={[
              styles.white,
              styles.railLabel,
              index === 0
                ? styles.railFirst
                : index === last
                  ? styles.railLast
                  : { left: `${(index / last) * 100}%` },
              stop.state !== 'now' && stop.state !== 'next' && styles.soft,
            ]}
          >
            {stop.time}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Ring({
  share,
  side = FIGURE_RING,
  line = 4,
}: {
  share: number;
  side?: number;
  line?: number;
}) {
  const r = (side - line) / 2;
  const round = 2 * Math.PI * r;

  return (
    <Svg
      width={side}
      height={side}
      style={styles.ring}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle
        cx={side / 2}
        cy={side / 2}
        r={r}
        fill="none"
        stroke={tokens.colorInkOnDark}
        strokeOpacity={0.18}
        strokeWidth={line}
      />
      <Circle
        cx={side / 2}
        cy={side / 2}
        r={r}
        fill="none"
        stroke={tokens.colorInkOnDark}
        strokeWidth={line}
        strokeLinecap="round"
        strokeDasharray={`${round * share} ${round}`}
      />
    </Svg>
  );
}

/** Now's arrived figure (sc-29978), read as its words: "141/152" over "arrived" beside a ring, or "37" over "arrived" with no ring while nobody is Coming. */
export function ArrivedFigure({ figure }: { figure: Figure }) {
  return (
    <View style={styles.arrived} accessible accessibilityLabel={figure.spoken}>
      {figure.share != null && <Ring share={figure.share} />}
      <View style={styles.shrink}>
        <View style={styles.figureLine}>
          <Text size={18} weight="bold" accessible={false} style={[styles.white, styles.figures]}>
            {figure.count}
          </Text>
          {figure.of != null && (
            <Text
              size={18}
              weight="semibold"
              accessible={false}
              style={[styles.white, styles.figures, styles.soft, styles.tight]}
            >
              {`/${figure.of}`}
            </Text>
          )}
        </View>
        <Text size={12.5} weight="medium" accessible={false} style={[styles.white, styles.soft]}>
          {figure.label}
        </Text>
      </View>
    </View>
  );
}

/** The arrived figure from AX1 on the iPad's live cover (sc-94022): its numbers step down as one unit only where they would not fit one line beside the ring, never under 18 and never larger than the name (`under`); arrived steps alone, never larger than the numbers; the ring is as tall as the two lines as drawn. Hidden until the numbers are measured. */
function WholeArrivedFigure({
  figure,
  column,
  under,
}: {
  figure: Figure;
  column: number;
  under: number;
}) {
  const { fontScale } = useWindowDimensions();
  const numbers = `${figure.count}${figure.of != null ? `/${figure.of}` : ''}`;
  const start = labelStart(FIGURE_NUMBERS, fontScale, under);
  const [measured, setMeasured] = useState<{ key: string; width: number } | null>(null);
  const key = `${start}|${numbers}`;
  const width = measured?.key === key ? measured.width : null;
  const labelAt = labelStart(FIGURE_LABEL, fontScale, Math.min(under, start));
  const ringAt = figureRing(start, labelAt);
  const side = figure.share != null ? ringAt : 0;
  const room = figureRoom(column, side, side > 0 ? tokens.spaceMd : 0);
  const pending = width == null || column === 0;
  const drawn = pending ? start : fitWidest(FIGURE_NUMBERS, start, width, Math.max(room, 1));
  const ring = figureRing(drawn, labelStart(FIGURE_LABEL, fontScale, Math.min(under, drawn)));
  const line = { lineHeight: Math.ceil(drawn * FIGURE_NUMBERS_LINE) };

  return (
    <>
      <MeasuredWords
        words={[numbers]}
        size={start}
        weight="bold"
        allowFontScaling={false}
        onWidth={(_, measuredWidth) =>
          setMeasured((now) =>
            now?.key === key && now.width === measuredWidth ? now : { key, width: measuredWidth },
          )
        }
      />
      <View
        style={[styles.arrived, pending && styles.waiting]}
        accessible
        accessibilityLabel={figure.spoken}
      >
        {figure.share != null && (
          <Ring share={figure.share} side={ring} line={figureStroke(ring)} />
        )}
        <View style={styles.shrink}>
          <View style={styles.figureLine}>
            <Text
              key={`count|${drawn}`}
              size={drawn}
              weight="bold"
              allowFontScaling={false}
              accessible={false}
              style={[styles.white, styles.figures, line]}
            >
              {figure.count}
            </Text>
            {figure.of != null && (
              <Text
                key={`of|${drawn}`}
                size={drawn}
                weight="semibold"
                allowFontScaling={false}
                accessible={false}
                style={[styles.white, styles.figures, styles.soft, styles.tight, line]}
              >
                {`/${figure.of}`}
              </Text>
            )}
          </View>
          <CoverLine
            size={FIGURE_LABEL}
            line={FIGURE_LABEL_LINE}
            weight="medium"
            room={figure.share != null ? figureRoom(column, ring, tokens.spaceMd) : column}
            under={drawn}
            accessible={false}
            style={[styles.white, styles.soft]}
          >
            {figure.label}
          </CoverLine>
        </View>
      </View>
    </>
  );
}

function NextAndArrived({ now }: { now: Now }) {
  const { t } = useTranslation();

  return (
    <View style={styles.nextRow}>
      <View style={styles.next}>
        <Text size={12} weight="bold" style={[styles.white, styles.soft, styles.nextLabel]}>
          {t('todayScreen.next').toLocaleUpperCase()}
        </Text>
        <View style={styles.nextLine}>
          <Text size={16} weight="bold" style={[styles.white, styles.figures]}>
            {now.next.time}
          </Text>
          <Text size={16} weight="semibold" style={styles.white}>
            {now.next.title}
          </Text>
        </View>
      </View>
      {now.arrived != null && <ArrivedFigure figure={now.arrived} />}
    </View>
  );
}

/** The live cover on the iPad from AX1: every word whole, the name stepping until its widest word fits, nothing under it larger than it, and Open the event on the line under the end line (sc-92312 on its side, sc-93578 upright), then the arrived figure on the line under it (sc-94022), never between the end line and the button, where ux rejected it. Upright, the chips keep main's size and grow to hold their words (sc-93211), as they do on the phone (sc-93855). */
function WholeNowBlock({ now, upright }: { now: Now; upright: boolean }) {
  const { t } = useTranslation();
  const { open: go } = useTodayShell();
  const [column, setColumn] = useState(0);
  const [name, setName] = useState<number | null>(null);
  const under = name ?? Infinity;
  const open = (
    <WholeWhiteButton
      label={t('todayScreen.openEvent')}
      onPress={() => go({ to: 'event', id: now.event.id, name: now.name })}
      column={column}
      under={under}
    />
  );
  const words = (
    <View
      style={[styles.grow, styles.gapMd]}
      onLayout={(event) => setColumn(event.nativeEvent.layout.width)}
    >
      {upright ? <Chips now={now} grows /> : <WholeChips now={now} column={column} under={under} />}
      <CoverLine
        size={48}
        line={1.06}
        weight="bold"
        accessibilityRole="header"
        room={column}
        onDrawn={setName}
        style={[styles.white, { letterSpacing: 48 * -0.02 }]}
      >
        {now.name}
      </CoverLine>
      <CoverLine
        size={16}
        line={1.3}
        weight="semibold"
        room={column}
        under={under}
        style={styles.white}
      >
        {now.ends}
      </CoverLine>
      <View style={styles.openUnder}>{open}</View>
      {now.arrived != null && (
        <View style={styles.arrivedUnder}>
          <WholeArrivedFigure figure={now.arrived} column={column} under={under} />
        </View>
      )}
    </View>
  );

  return words;
}

export function NowBlock({
  moment,
  wide,
  side = false,
}: {
  moment: Moment;
  wide: boolean;
  /** On the iPad's side banner rather than upright (sc-92312). */
  side?: boolean;
}) {
  const { t } = useTranslation();
  const { open: go } = useTodayShell();
  const whole = useAccessibilitySizes();
  const [column, setColumn] = useState(0);
  const [name, setName] = useState<number | null>(null);
  const { now, run } = moment;

  if (now == null) return null;

  if (wide && whole && run == null && !moment.full)
    return <WholeNowBlock now={now} upright={!side} />;

  if (run != null)
    return (
      <RunNowBlock
        now={now}
        run={run}
        asOf={moment.asOf ?? null}
        wide={wide}
        aside={now.arrived != null && <ArrivedFigure figure={now.arrived} />}
        onOpen={() =>
          go({ to: 'runOfShow', id: now.event.id, name: now.name, track: run.track ?? null })
        }
      />
    );

  if (!moment.full) {
    const words = (
      <>
        <Chips now={now} grows={whole} />
        {!wide && whole ? (
          <CoverLine
            size={36}
            line={1.06}
            weight="bold"
            accessibilityRole="header"
            room={column}
            onDrawn={setName}
            style={[styles.white, { letterSpacing: 36 * -0.02 }]}
          >
            {now.name}
          </CoverLine>
        ) : (
          <Text
            size={wide ? 48 : 36}
            weight="bold"
            accessibilityRole="header"
            style={[
              styles.white,
              { letterSpacing: (wide ? 48 : 36) * -0.02, lineHeight: (wide ? 48 : 36) * 1.06 },
            ]}
          >
            {now.name}
          </Text>
        )}
        {!wide && whole ? (
          <CoverLine
            size={16}
            line={1.3}
            weight="semibold"
            room={column}
            under={name ?? Infinity}
            style={styles.white}
          >
            {now.ends}
          </CoverLine>
        ) : (
          <Text size={16} weight="semibold" style={styles.white}>
            {now.ends}
          </Text>
        )}
      </>
    );
    const label = t('todayScreen.openEvent');
    const onOpen = () => go({ to: 'event', id: now.event.id, name: now.name });
    const open =
      !wide && whole ? (
        <WholeWhiteButton label={label} onPress={onOpen} column={column} under={name ?? Infinity} />
      ) : (
        <WhiteButton label={label} onPress={onOpen} />
      );

    return wide ? (
      <View style={styles.wideRow}>
        <View style={[styles.grow, styles.gapMd]}>{words}</View>
        {now.arrived == null ? (
          open
        ) : (
          <View style={styles.right}>
            <ArrivedFigure figure={now.arrived} />
            {open}
          </View>
        )}
      </View>
    ) : (
      <View style={styles.gapLg} onLayout={(event) => setColumn(event.nativeEvent.layout.width)}>
        {words}
        {now.arrived != null && <ArrivedFigure figure={now.arrived} />}
        <View style={styles.hair} />
        {open}
      </View>
    );
  }

  const size = wide ? 58 : 44;
  const head = (
    <View style={styles.gapSm}>
      <Text size={15} weight="semibold" style={styles.white}>
        {now.name}
      </Text>
      <Text
        size={size}
        weight="bold"
        accessibilityRole="header"
        style={[styles.white, { letterSpacing: size * -0.02, lineHeight: size * 1.04 }]}
      >
        {now.happening}
      </Text>
      <View style={styles.until}>
        <Text size={16} weight="semibold" style={styles.white}>
          {now.until}
        </Text>
        <Glass height={26} style={styles.behind}>
          <Text size={13} weight="semibold" style={styles.white}>
            {now.behind}
          </Text>
        </Glass>
      </View>
    </View>
  );
  const open = (
    <WhiteButton
      label={t('todayScreen.openRunOfShow')}
      onPress={() => go({ to: 'event', id: now.event.id, name: now.name })}
    />
  );

  return wide ? (
    <View style={styles.gapXl}>
      <View style={styles.wideRow}>
        <View style={[styles.grow, styles.gapLg]}>
          <Chips now={now} />
          {head}
        </View>
        <View style={styles.right}>
          <NextAndArrived now={now} />
          {open}
        </View>
      </View>
      <Rail now={now} />
    </View>
  ) : (
    <View style={styles.gapLg}>
      <Chips now={now} />
      {head}
      <Rail now={now} />
      <NextAndArrived now={now} />
      {open}
    </View>
  );
}

function Mesh({
  moment,
  pieces,
  top,
  body,
  shade,
}: {
  moment: Moment;
  pieces: readonly Piece[];
  top: number;
  body: number;
  shade: 'foot' | 'side';
}) {
  if (moment.now != null) return <EventMesh event={moment.now.event} shade="day" />;

  return (
    <>
      <Cover pieces={[]} shade={shade} />
      <View style={[styles.pieces, { top, height: body }]}>
        <Confetti pieces={pieces} />
      </View>
    </>
  );
}

export function TodayCover({
  moment,
  layout,
  top,
  onTab,
  words = 1,
  onGreeting,
}: {
  moment: Moment;
  layout: CoverLayout;
  top: number;
  onTab: (tab: Tab) => void;
  /** The size the greeting drew at from AX1, null below it or while no greeting shows. */
  onGreeting?: ((size: number | null) => void) | undefined;
  /** How much of the top row and the words still show: they go as the cover scrolls up, before the band comes. */
  words?: Animated.AnimatedInterpolation<number> | number;
}) {
  const day = moment.kind === 'day';
  const insets = useSafeAreaInsets();
  const [greeting, setGreeting] = useState<number | null>(null);
  const greeted = useCallback(
    (size: number | null) => {
      setGreeting(size);
      onGreeting?.(size);
    },
    [onGreeting],
  );

  if (layout === 'landscape')
    return (
      <View style={[styles.banner, styles.bannerGrows, { minHeight: coverBody(moment, layout) }]}>
        <Mesh
          moment={moment}
          pieces={BANNER_PIECES}
          top={0}
          body={coverBody(moment, layout)}
          shade="side"
        />
        <View style={styles.bannerBell}>
          <BellButton />
        </View>
        <View style={day ? styles.bannerNow : styles.bannerGreeting}>
          {day ? (
            <NowBlock moment={moment} wide side />
          ) : (
            <Greeting
              moment={moment}
              size={38}
              sub={17}
              gap={tokens.spaceSm}
              onDrawn={onGreeting}
            />
          )}
        </View>
      </View>
    );

  const phone = layout === 'phone';
  const body = coverBody(moment, layout);

  // At the board's height, unless the words at the foot need more: a narrow phone wraps the greeting, and the cover grows down, never into the confetti.
  return (
    <View style={[styles.cover, { minHeight: top + body }]}>
      <View style={[styles.overscroll, day && styles.overscrollDay]} />
      <Mesh
        moment={moment}
        pieces={phone ? PHONE_PIECES : PORTRAIT_PIECES}
        top={top}
        body={body}
        shade="foot"
      />
      <Animated.View style={[styles.coverWords, { opacity: words }]}>
        {phone ? <PhoneTop top={top} greeting={greeting} /> : <TabletTop top={top} onTab={onTab} />}
        <View style={[styles.grow, { minHeight: footClear(moment, phone) }]} />
        <View
          style={
            phone
              ? [styles.footPhone, sidePadding(tokens.spaceXxl, insets)]
              : day
                ? styles.footTabletNow
                : styles.footTablet
          }
        >
          {day ? (
            <NowBlock moment={moment} wide={!phone} />
          ) : phone ? (
            <Greeting moment={moment} size={32} sub={16} gap={tokens.spaceSm} onDrawn={greeted} />
          ) : (
            <Greeting
              moment={moment}
              size={46}
              sub={19}
              gap={tokens.spaceMd}
              onDrawn={onGreeting}
            />
          )}
        </View>
      </Animated.View>
    </View>
  );
}

/** The upright iPad's top row: the opener keeps to the left of the centred capsule; from AX1 its words stay whole and it grows down while the tabs, Search and the bell keep to the top (sc-92314). */
function TabletTop({ top, onTab }: { top: number; onTab: (tab: Tab) => void }) {
  const [row, setRow] = useState<number>();
  const [end, setEnd] = useState<number>();
  const { labelSize, givesWay, width, measure } = useCapsuleLabels(
    useTabLabels(),
    tabletRow(row),
    end,
  );
  const room = openerRoom(row, width);
  const large = useAccessibilitySizes();
  const [capsule, setCapsule] = useState(CAPSULE_HEIGHT);

  return (
    <View
      style={[
        styles.topTablet,
        large && styles.topTabletTall,
        { marginTop: top },
        capsule > CAPSULE_HEIGHT && { minHeight: CAPSULE_TOP + capsule },
      ]}
      onLayout={(event) => setRow(event.nativeEvent.layout.width)}
    >
      {measure}
      <OrgButton
        maxWidth={room}
        givesWay={givesWay}
        nameRoom={large ? uprightNameRoom(room) : undefined}
      />
      <View style={styles.grow} />
      <View onLayout={(event) => setEnd(event.nativeEvent.layout.width)}>
        <SearchAndBell />
      </View>
      <View style={styles.capsuleAt} pointerEvents="box-none">
        <View key={labelSize} onLayout={(event) => setCapsule(event.nativeEvent.layout.height)}>
          {labelSize != null && <TabCapsule onTab={onTab} labelSize={labelSize} />}
        </View>
      </View>
    </View>
  );
}

function useTabLabels(): string[] {
  const { t } = useTranslation();

  return TABS.map(([, glyph]) => t(`todayScreen.tab.${glyph}`));
}

/** The upright tablet's row inside its side margins. */
function tabletRow(width: number | undefined): number {
  return width == null ? 0 : Math.max(0, width - 2 * tokens.space3xl);
}

export function Band({
  moment,
  layout,
  top,
  onTab,
}: {
  moment: Moment;
  layout: Exclude<CoverLayout, 'landscape'>;
  top: number;
  onTab: (tab: Tab) => void;
}) {
  const { t } = useTranslation();
  const { now } = moment;
  const phone = layout === 'phone';
  const [row, setRow] = useState<number>();
  const [end, setEnd] = useState<number>();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { labelSize, measure } = useCapsuleLabels(useTabLabels(), phone ? 0 : tabletRow(row), end);
  const named =
    now == null || moment.run != null || moment.full
      ? null
      : t('todayScreen.liveName', { name: now.name });
  const grown = !phone && named != null && atAccessibilitySizes(fontScale);
  const [capsule, setCapsule] = useState(CAPSULE_HEIGHT);
  const tall = capsule > CAPSULE_HEIGHT;
  const [tileEnd, setTileEnd] = useState<number>();
  const [searchStart, setSearchStart] = useState<number>();
  const [rowMiddle, setRowMiddle] = useState<number>();
  const height = top + bandBody(moment, layout);
  const underTitle = phone && atAccessibilitySizes(fontScale);
  const [rowAt, setRowAt] = useState<{ x: number; y: number }>();
  const [titleBox, setTitleBox] = useState<Box | null>(null);
  const titleOnBand =
    rowAt == null || titleBox == null
      ? null
      : { ...titleBox, x: rowAt.x + titleBox.x, y: rowAt.y - top + titleBox.y };
  const liveSize =
    underTitle && rowMiddle != null
      ? bandLiveSize(fontScale, bandLiveRoom(rowMiddle, height, LIVE_FOOT))
      : undefined;

  return (
    <View
      style={[styles.band, { [grown || tall ? 'minHeight' : 'height']: height }]}
      onLayout={(event) => setRow(event.nativeEvent.layout.width)}
    >
      {now == null ? (
        <>
          <Cover pieces={[]} shade="foot" />
          <View style={[styles.pieces, { top, bottom: 0 }]}>
            <Confetti
              pieces={phone ? BAND_PIECES : TABLET_BAND_PIECES}
              words={underTitle ? (titleOnBand == null ? null : [titleOnBand]) : undefined}
            />
          </View>
        </>
      ) : (
        <EventMesh event={now.event} shade="day" />
      )}
      <View
        style={[
          phone ? [styles.topPhone, coverRowSides(insets)] : [styles.topTablet, styles.capsuleRoom],
          { marginTop: top },
          tall && { minHeight: CAPSULE_TOP + capsule },
        ]}
        onLayout={({ nativeEvent: { layout } }) => {
          // The middle under its top padding, where the tile and the title are centred.
          setRowMiddle(layout.y + (layout.height + styles.topPhone.paddingTop) / 2);
          setRowAt({ x: layout.x, y: layout.y });
        }}
      >
        {!phone && measure}
        <View onLayout={({ nativeEvent: { layout } }) => setTileEnd(layout.x + layout.width)}>
          <OrgButton compact />
        </View>
        <View style={styles.grow} />
        <View
          onLayout={({ nativeEvent: { layout } }) => {
            setEnd(layout.width);
            setSearchStart(layout.x);
          }}
        >
          <SearchAndBell />
        </View>
        {phone ? (
          <BandTitleText
            row={
              row == null || tileEnd == null || searchStart == null
                ? undefined
                : { width: row, tileEnd, searchStart }
            }
            onTitle={setTitleBox}
          />
        ) : (
          <View style={styles.capsuleAt} pointerEvents="box-none">
            <View key={labelSize} onLayout={(event) => setCapsule(event.nativeEvent.layout.height)}>
              {labelSize != null && <TabCapsule onTab={onTab} labelSize={labelSize} />}
            </View>
          </View>
        )}
      </View>
      {grown ? (
        <BandLiveLine scale={fontScale} said={named} width={row} />
      ) : (
        now != null && (
          <View style={[styles.bandNow, phone && pastSides(tokens.spaceXl, insets)]}>
            <View style={styles.liveDot} />
            <Text
              key={liveSize}
              size={liveSize ?? 13.5}
              weight="semibold"
              numberOfLines={1}
              allowFontScaling={!underTitle}
              // From AX1 hidden until the row is measured, so no frame draws it over the title.
              style={[
                styles.white,
                liveSize != null && { lineHeight: liveLineHeight(liveSize) },
                underTitle && liveSize == null && styles.waiting,
              ]}
            >
              {moment.run != null
                ? moment.run.band
                : (named ??
                  t('todayScreen.nowLine', { happening: now.happening, until: now.until }))}
            </Text>
          </View>
        )
      )}
    </View>
  );
}

/** The phone's band title: main's below AX1; from AX1 whole on one line, 8 clear of the tile and Search, in the row's height (sc-92248). */
function BandTitleText({
  row,
  onTitle,
}: {
  row: BandRow | undefined;
  /** From AX1, the title's box in the row once it draws at its fitted size; null until then. */
  onTitle: (box: Box | null) => void;
}) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const title = t('todayScreen.today');
  const large = atAccessibilitySizes(fontScale);
  const start = bandStart(fontScale);
  const { widths, measure } = useMeasuredAt(start, [title]);
  const [wide] = widths;
  const fitted = row == null || wide == null ? undefined : bandTitle(fontScale, wide, row);
  const drawn = fitted?.size ?? start;
  const [placed, setPlaced] = useState<{ x: number; y: number }>();
  const [text, setText] = useState<{ size: number; box: Box }>();
  const ready = large && fitted != null && text?.size === drawn;

  useEffect(() => {
    onTitle(
      !ready || placed == null || text == null
        ? null
        : { ...text.box, x: placed.x + text.box.x, y: placed.y + text.box.y },
    );
  }, [onTitle, ready, placed, text]);

  if (!large) {
    return (
      <View style={styles.bandTitle} pointerEvents="box-none">
        <Text size={BAND_TITLE} weight="semibold" accessibilityRole="header" style={styles.white}>
          {title}
        </Text>
      </View>
    );
  }

  const inRoom = fitted?.centred === 'room' && row != null;

  return (
    <>
      {measure}
      <View
        style={[
          styles.bandTitle,
          inRoom && { left: row.tileEnd + BAND_CLEAR, right: undefined, width: bandRoom(row) },
        ]}
        pointerEvents="box-none"
        onLayout={({ nativeEvent: { layout } }) => setPlaced({ x: layout.x, y: layout.y })}
      >
        <Text
          key={drawn}
          onLayout={({ nativeEvent: { layout } }) => setText({ size: drawn, box: layout })}
          size={drawn}
          weight="semibold"
          allowFontScaling={false}
          accessibilityRole="header"
          numberOfLines={1}
          // Hidden until it is measured, so no frame draws it under Search.
          style={[styles.white, { lineHeight: bandLine(drawn) }, fitted == null && styles.waiting]}
        >
          {title}
        </Text>
      </View>
    </>
  );
}

interface TabBarProps<T extends string> {
  tabs: readonly (readonly [T, GlyphName])[];
  bottom: number;
  onTab: (tab: T) => void;
  at: T;
  say?: (tab: T, glyph: GlyphName) => string;
  ids?: Partial<Record<T, string>>;
  /** A tab that opens something, which hands focus back to it when it closes. */
  refs?: Partial<Record<T, Ref<ViewInstance>>>;
  /** Its labels step down below the default size, as far as 10, where that keeps every word whole: the event's bar alone (sc-71148). */
  stepsBelowDefault?: boolean;
}

/** Each tab word's width at its start, kept past the bar that measured it, so the next bar draws fitted from its first frame (sc-99214). */
const TAB_WORDS = new Map<string, number>();

/** The labels at one size, never under the default, or under 10 on the event's bar (sc-37298, sc-71148). Measured at semibold, so selecting a tab never moves it, and fitted to a tab worked out from this render's window, never one measured before a turn (sc-99214). */
export function TabBar<T extends string>({
  tabs,
  bottom,
  onTab,
  at,
  say = (tab) => tab,
  ids,
  refs,
  stepsBelowDefault,
}: TabBarProps<T>) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const start = tabLabelStart(fontScale);
  const words = wordsIn(tabs.map(([label, glyph]) => say(label, glyph)));
  const { widths, measure } = useMeasuredAt(start, words, TAB_WORDS);
  const measured = widths.every((word) => word != null);
  const widest = measured ? Math.max(...widths.map(Number)) : 0;
  const slot = tabWidth(width, insets, tabs.length, PixelRatio.get());
  const size = stepsBelowDefault
    ? eventBarLabelSize(fontScale, widest, slot)
    : fitWidest(TAB_LABEL, start, widest, slot);

  return (
    <View style={[styles.tabBar, tabBarFit(width, insets), { bottom }]} accessibilityRole="tablist">
      {measure}
      {tabs.map(([label, glyph]) => {
        const on = label === at;
        const ink = on ? tokens.colorAccent : tokens.colorInkSecondary;

        return (
          <Pressable
            key={label}
            ref={refs?.[label]}
            onPress={() => onTab(label)}
            style={[styles.tab, on && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={say(label, glyph)}
            testID={ids?.[label] ?? `tab-${label.toLowerCase()}`}
          >
            <Glyph name={glyph} size={22} ink={ink} />
            <Text
              size={size}
              allowFontScaling={false}
              weight={on ? 'semibold' : 'medium'}
              accessible={false}
              // Hidden until its words are measured, so no frame draws one cut.
              style={[styles.tabLabelCentred, !measured && styles.waiting, { color: ink }]}
            >
              {say(label, glyph)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** An upright iPad's tab bar on white, centred at the top of the page. */
export function WhiteCapsule<T extends string>({
  tabs,
  onTab,
  at,
  say,
  ids,
  labelSize,
}: {
  tabs: readonly (readonly [T, GlyphName])[];
  onTab: (tab: T) => void;
  at: T;
  say: (tab: T, glyph: GlyphName) => string;
  ids?: Partial<Record<T, string>>;
  /** The one size its labels are drawn at, where the row it sits in chooses it (sc-40401). */
  labelSize?: number | undefined;
}) {
  return (
    <View style={styles.whiteCapsule} accessibilityRole="tablist">
      {tabs.map(([label, glyph]) => {
        const on = label === at;
        const ink = on ? tokens.colorAccent : tokens.colorInkSecondary;

        return (
          <Pressable
            key={label}
            onPress={() => onTab(label)}
            hitSlop={tokens.spaceXxs}
            style={[styles.whiteCapsuleTab, on && styles.whiteCapsuleOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={say(label, glyph)}
            testID={ids?.[label]}
          >
            <Glyph name={glyph} ink={ink} />
            <Text
              size={CAPSULE_LABEL}
              weight="semibold"
              maxFontSizeMultiplier={capsuleLabelMultiplier(labelSize)}
              numberOfLines={labelSize == null ? undefined : 1}
              accessible={false}
              style={{ color: ink }}
            >
              {say(label, glyph)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Under the phone's tab bar, the page fades to white so nothing reads through it. */
export function TabBarFade() {
  return (
    <View style={styles.fade} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="tabBarFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tokens.colorCard} stopOpacity={0} />
            <Stop offset="0.62" stopColor={tokens.colorCard} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#tabBarFade)" />
      </Svg>
    </View>
  );
}

/** The phone's tab bar is this tall, so a page clears it. */
export const PHONE_TAB_BAR = 64;

/** How far the phone's tab bar floats above the screen's foot. */
export function tabBarFoot(bottomInset: number): number {
  return Math.max(bottomInset - tokens.spaceXxs, tokens.spaceLg);
}

/** How far the phone's tab bar and its fade reach up from the screen's foot. */
export function phoneTabBarClearance(bottomInset: number): number {
  return tabBarFoot(bottomInset) + PHONE_TAB_BAR;
}

export function PhoneTabBar({
  bottom,
  onTab,
  at = 'Today',
}: {
  bottom: number;
  onTab: (tab: Tab) => void;
  at?: Tab;
}) {
  const { t } = useTranslation();

  return (
    <TabBar
      tabs={TABS}
      bottom={bottom}
      onTab={onTab}
      at={at}
      say={(_, glyph) => t(`todayScreen.tab.${glyph}`)}
      ids={SETTINGS_ID}
    />
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  ends: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: TAB_FADE },
  whiteCapsule: {
    minHeight: CAPSULE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceHair,
    padding: tokens.spaceXxs,
    borderRadius: 23,
    backgroundColor: tokens.colorInset,
  },
  whiteCapsuleTab: {
    minHeight: CAPSULE_HEIGHT - 2 * tokens.spaceXxs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: 13,
    paddingRight: tokens.spaceXl,
    borderRadius: 19,
  },
  whiteCapsuleOn: { backgroundColor: tokens.colorCard, ...tokens.elevationNative.raised.ios },
  white: { color: tokens.colorInkOnDark },
  accent: { color: tokens.colorAccent },
  soft: { opacity: 0.84 },
  figures: { fontVariant: ['tabular-nums'] },
  tight: { marginLeft: 1 },
  pressed: { opacity: 0.8 },
  hair: { height: tokens.spaceHair },
  gapSm: { gap: tokens.spaceSm },
  gapMd: { gap: tokens.spacePillEnd },
  gapLg: { gap: tokens.spaceXl },
  gapXl: { gap: 22 },
  orgFit: { flexDirection: 'row', flexShrink: 1, minWidth: 0 },
  orgWide: { flexShrink: 1 },
  orgGlass: {
    flexShrink: 1,
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceXs,
    paddingLeft: tokens.spaceSm,
    paddingRight: tokens.spacePillEnd,
  },
  orgCompact: { paddingHorizontal: 5 },
  tileRing: {
    position: 'absolute',
    top: -4,
    end: -4,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2,
    borderColor: tokens.colorInkOnDark,
  },
  bell: { width: 40, justifyContent: 'center' },
  unread: {
    position: 'absolute',
    right: 9,
    top: 9,
    width: tokens.spaceSm,
    height: tokens.spaceSm,
    borderRadius: tokens.spaceXxs,
    backgroundColor: tokens.colorBroken,
    borderWidth: 1.5,
    borderColor: tokens.colorInkOnDark,
  },
  capsule: { padding: tokens.spaceXxs, gap: tokens.spaceHair },
  capsuleTab: {
    minHeight: CAPSULE_HEIGHT - 2 * tokens.spaceXxs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: 13,
    paddingRight: tokens.spaceXl,
    borderRadius: 19,
  },
  capsuleOn: { backgroundColor: tokens.colorCard },
  capsuleAt: { position: 'absolute', left: 0, right: 0, top: CAPSULE_TOP, alignItems: 'center' },
  capsuleRoom: { minHeight: CAPSULE_TOP + CAPSULE_HEIGHT },
  eyebrow: { letterSpacing: 12 * 0.08, opacity: 0.92 },
  subLine: { flexDirection: 'row', flexWrap: 'wrap' },
  liveDot: {
    width: tokens.spaceSm,
    height: tokens.spaceSm,
    borderRadius: tokens.spaceXxs,
    backgroundColor: tokens.colorBroken,
  },
  until: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  behind: { paddingHorizontal: 11 },
  rail: { gap: tokens.spaceMd, paddingTop: tokens.spaceXxs, paddingHorizontal: tokens.spaceXxs },
  railLine: { height: tokens.spaceXl },
  railTrack: {
    position: 'absolute',
    left: 0,
    top: 7,
    height: tokens.spaceHair,
    borderRadius: 1,
    backgroundColor: tokens.colorInkOnDark,
  },
  railFaint: { right: 0, opacity: 0.18 },
  node: {
    position: 'absolute',
    top: 3.5,
    width: 9,
    height: 9,
    marginLeft: -4.5,
    borderRadius: 4.5,
  },
  nodeDone: { backgroundColor: tokens.colorInkOnDark },
  nodeLater: { borderWidth: 1.5, borderColor: tokens.colorInkOnDark, opacity: 0.6 },
  nowGlow: {
    position: 'absolute',
    top: -5,
    width: 26,
    height: 26,
    marginLeft: -13,
    borderRadius: 13,
    backgroundColor: tokens.colorInkOnDark,
    opacity: 0.25,
  },
  nowNode: {
    position: 'absolute',
    top: 0,
    width: tokens.spaceXl,
    height: tokens.spaceXl,
    marginLeft: -tokens.spaceSm,
    borderRadius: tokens.spaceSm,
    backgroundColor: tokens.colorInkOnDark,
  },
  railLabels: { height: tokens.spacePillEnd },
  railLabel: { position: 'absolute', width: 64, marginLeft: -32, textAlign: 'center' },
  railFirst: { left: 0, marginLeft: 0, textAlign: 'left' },
  railLast: { right: 0, marginLeft: 0, textAlign: 'right' },
  ring: { transform: [{ rotate: '-90deg' }] },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXl },
  next: { flex: 1, gap: 3 },
  nextLabel: { letterSpacing: 12 * 0.08 },
  nextLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 5 },
  arrived: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  figureLine: { flexDirection: 'row', alignItems: 'baseline' },
  shrink: { flexShrink: 1 },
  wideRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 36 },
  openUnder: { alignItems: 'flex-start', marginTop: tokens.spaceXs },
  arrivedUnder: { alignItems: 'flex-start', marginTop: tokens.spaceXs },
  right: { width: 340, gap: 18 },
  pieces: { position: 'absolute', left: 0, right: 0 },
  cover: { overflow: 'visible', backgroundColor: tokens.colorAccent },
  coverWords: { flexGrow: 1 },
  overscroll: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    height: 800,
    backgroundColor: tokens.colorAccent,
  },
  overscrollDay: { backgroundColor: tokens.optionRose },
  topPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceXxs,
  },
  topTablet: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: tokens.spaceMd,
    paddingHorizontal: tokens.space3xl,
  },
  topTabletTall: { alignItems: 'flex-start' },
  footPhone: { marginBottom: SHEET_RISE + OPEN_ABOVE_SHEET },
  footTablet: { marginHorizontal: tokens.space5xl, marginBottom: SHEET_RISE + 30, maxWidth: 620 },
  footTabletNow: { marginHorizontal: tokens.space5xl, marginBottom: SHEET_RISE + tokens.space4xl },
  banner: { borderRadius: tokens.space4xl, overflow: 'hidden' },
  bannerBell: { position: 'absolute', right: tokens.spaceXxl, top: 18 },
  bannerGreeting: {
    marginHorizontal: 30,
    marginBottom: tokens.space4xl,
    marginTop: 18,
    maxWidth: 520,
  },
  bannerGrows: { justifyContent: 'flex-end' },
  bannerNow: { marginHorizontal: tokens.space4xl, marginBottom: 26, marginTop: 76 },
  band: { overflow: 'hidden' },
  bandTitle: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  waiting: { opacity: 0 },
  bandNow: {
    position: 'absolute',
    left: tokens.spaceXl,
    right: tokens.spaceXl,
    bottom: tokens.spaceLg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceXs,
  },
  tabBar: {
    position: 'absolute',
    height: PHONE_TAB_BAR,
    borderRadius: tokens.space5xl,
    backgroundColor: tokens.colorCard,
    borderWidth: TAB_BAR_BORDER,
    borderColor: tokens.colorBorder,
    flexDirection: 'row',
    ...tokens.elevationNative.raised.ios,
    elevation: tokens.elevationNative.raised.android.elevation,
  },
  tab: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabOn: { backgroundColor: tokens.colorAccentTint },
  tabLabelCentred: { textAlign: 'center' },
});
