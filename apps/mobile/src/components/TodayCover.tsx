import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Pressable,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Text } from './Text.tsx';
import { useWholeWords } from './Title.tsx';
import { tokens } from '../theme/tokens.ts';
import { Confetti, Cover, type Piece } from './Cover.tsx';
import { EventMesh } from './EventMesh.tsx';
import { Glyph, type GlyphName } from './Glyph.tsx';
import type { Moment, Now } from '../kit/today.ts';
import { useAccessibilitySizes, useLayout, useNameLines } from '../layout/useLayout.ts';
import { OrgMark } from './OrgMark.tsx';
import { OPENER, OpenerWords } from './OrgPill.tsx';
import { useTodayShell } from './todayShell.ts';
import { usePillFit } from './usePillFit.tsx';

export type CoverLayout = 'phone' | 'portrait' | 'landscape';

export const SHEET_RISE = tokens.space4xl;

/** The cover's height under the status bar, from the board: taller on the day, when it is Now. */
export function coverBody(moment: Moment, layout: CoverLayout): number {
  const day = moment.kind === 'day';

  if (layout === 'phone') return day ? (moment.full ? 514 : 376) : 262;
  if (layout === 'portrait') return day ? (moment.full ? 530 : 410) : 350;

  return day ? (moment.full ? 330 : 236) : 200;
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

export function Glass({
  children,
  height = 40,
  grows = false,
  style,
  testID,
}: {
  children: ReactNode;
  height?: number;
  /** Taller than `height` when its words wrap, rather than clipped to it. */
  grows?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}) {
  return (
    <View
      testID={testID}
      style={[
        styles.glass,
        grows ? { minHeight: height } : { height },
        { borderRadius: height / 2 },
        style,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, styles.glassFill]} />
      {children}
    </View>
  );
}

/** The switcher's opener in glass: the tile alone on the band, the tile, the name and what waits on the cover. */
export function OrgButton({
  compact = false,
  maxWidth,
}: {
  compact?: boolean;
  /** The most it may take, so it stops short of what sits beside it. */
  maxWidth?: number | undefined;
}) {
  const ref = useRef<ViewInstance>(null);
  const org = useTodayShell().useOrgOpener(ref, !compact);
  const phone = useLayout().kind === 'phone';
  const large = useAccessibilitySizes();
  const lines = useNameLines();
  const { tileAlone, measure } = usePillFit(org.name, org.waiting, maxWidth, large);
  const shared = {
    ref,
    onPress: org.onPress,
    accessibilityRole: 'button',
    accessibilityLabel: org.label,
    accessibilityState: { expanded: org.expanded },
    hitSlop: tokens.spaceXxs,
    testID: 'home.switchOrganisation',
  } as const;

  if (compact)
    return (
      <Pressable {...shared}>
        <Glass style={styles.orgCompact}>
          <OrgMark id={org.id} name={org.name} side={30} glass />
        </Glass>
      </Pressable>
    );

  const tall = org.waiting != null ? OPENER.waiting : 40;
  // Clear of the bell by the cover's side margin; the phone's row already sets a gap either side of its spacer.
  const clear = phone ? tokens.spaceXl - 2 * tokens.spaceSm : tokens.space3xl;
  const wrap = phone || large;

  if (tileAlone)
    return (
      <View style={[styles.orgFit, { marginRight: clear, maxWidth }]}>
        {measure}
        <Pressable {...shared}>
          <Glass style={styles.orgCompact}>
            <OrgMark id={org.id} name={org.name} side={30} glass />
          </Glass>
          {org.waiting != null && <View style={styles.tileRing} />}
        </Pressable>
      </View>
    );

  return (
    <View style={[styles.orgFit, { marginRight: clear, maxWidth }]}>
      {measure}
      <Pressable {...shared} style={styles.orgWide}>
        <Glass height={tall} style={[styles.orgGlass, { height: undefined, minHeight: tall }]}>
          <OrgMark id={org.id} name={org.name} side={28} glass />
          <OpenerWords
            name={org.name}
            waiting={org.waiting}
            onDark
            wrap={wrap}
            lines={wrap ? undefined : lines}
          />
          <Glyph name="updown" size={14} ink={tokens.colorInkOnDark} />
        </Glass>
      </Pressable>
    </View>
  );
}

export function BellButton() {
  const { t } = useTranslation();
  const { unread, open } = useTodayShell();

  return (
    <Pressable
      onPress={() => open({ to: 'notifications' })}
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
  );
}

/** iPadOS 26's tab bar, in glass at the top of the cover. */
export function TabCapsule({ onTab, at = 'Today' }: { onTab: (tab: Tab) => void; at?: Tab }) {
  const { t } = useTranslation();

  return (
    <Glass height={46} style={styles.capsule}>
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
            testID={SETTINGS_ID[label]}
          >
            <Glyph name={glyph} ink={ink} />
            <Text size={15} weight="semibold" accessible={false} style={{ color: ink }}>
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
}: {
  moment: Moment;
  size: number;
  sub: number;
  gap: number;
}) {
  return (
    <View style={{ gap }}>
      <Text size={12} weight="semibold" style={[styles.white, styles.eyebrow]}>
        {moment.eyebrow.toUpperCase()}
      </Text>
      <Text
        size={size}
        weight="bold"
        accessibilityRole="header"
        style={[styles.white, { lineHeight: Math.round(size * 1.08), letterSpacing: size * -0.02 }]}
      >
        {moment.hello}
      </Text>
      <View style={styles.subLine}>
        {moment.lead != null && (
          <Text size={sub} weight="bold" style={[styles.white, { lineHeight: sub * 1.45 }]}>
            {`${moment.lead} `}
          </Text>
        )}
        <Text size={sub} weight="medium" style={[styles.white, { lineHeight: sub * 1.45 }]}>
          {moment.sub}
        </Text>
      </View>
    </View>
  );
}

function WhiteButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.whiteButton, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text size={16} weight="semibold" accessible={false}>
        {label}
      </Text>
      <Glyph name="arrow" ink={tokens.colorInk} />
    </Pressable>
  );
}

function Chips({ now }: { now: Now }) {
  const { t } = useTranslation();

  return (
    <View style={styles.chips}>
      <View style={[styles.chip, styles.chipLight]}>
        <View style={styles.liveRing}>
          <View style={styles.liveDot} />
        </View>
        <Text size={13} weight="semibold">
          {t('todayScreen.liveNow')}
        </Text>
      </View>
      <View style={[styles.chip, styles.chipDark]}>
        <Text size={13} weight="semibold" style={styles.white} numberOfLines={1}>
          {now.live}
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

function Ring({ share, side = 44, line = 4 }: { share: number; side?: number; line?: number }) {
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
      <View
        style={styles.arrived}
        accessible
        accessibilityLabel={`${now.arrived} of ${now.expected} arrived`}
      >
        <Ring share={now.arrived / now.expected} />
        <View>
          <View style={styles.nextLine}>
            <Text size={18} weight="bold" accessible={false} style={[styles.white, styles.figures]}>
              {String(now.arrived)}
            </Text>
            <Text
              size={18}
              weight="semibold"
              accessible={false}
              style={[styles.white, styles.figures, styles.soft, styles.tight]}
            >
              {`/${now.expected}`}
            </Text>
          </View>
          <Text size={12.5} weight="medium" accessible={false} style={[styles.white, styles.soft]}>
            {t('todayScreen.arrivedCount')}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function NowBlock({ moment, wide }: { moment: Moment; wide: boolean }) {
  const { t } = useTranslation();
  const { open: go } = useTodayShell();
  const { now } = moment;

  if (now == null) return null;

  if (!moment.full) {
    const words = (
      <>
        <Chips now={now} />
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
        <Text size={16} weight="semibold" style={styles.white}>
          {now.ends}
        </Text>
      </>
    );
    const open = (
      <WhiteButton
        label={t('todayScreen.openEvent')}
        onPress={() => go({ to: 'event', id: now.event.id, name: now.name })}
      />
    );

    return wide ? (
      <View style={styles.wideRow}>
        <View style={[styles.grow, styles.gapMd]}>{words}</View>
        {open}
      </View>
    ) : (
      <View style={styles.gapLg}>
        {words}
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
}: {
  moment: Moment;
  layout: CoverLayout;
  top: number;
  onTab: (tab: Tab) => void;
  /** How much of the top row and the words still show: they go as the cover scrolls up, before the band comes. */
  words?: Animated.AnimatedInterpolation<number> | number;
}) {
  const day = moment.kind === 'day';

  if (layout === 'landscape')
    return (
      <View style={[styles.banner, { height: coverBody(moment, layout) }]}>
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
            <NowBlock moment={moment} wide />
          ) : (
            <Greeting moment={moment} size={38} sub={17} gap={tokens.spaceSm} />
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
        {phone ? (
          <View style={[styles.topPhone, { marginTop: top }]}>
            <OrgButton />
            <View style={styles.grow} />
            <BellButton />
          </View>
        ) : (
          <TabletTop top={top} onTab={onTab} />
        )}
        <View style={[styles.grow, { minHeight: footClear(moment, phone) }]} />
        <View style={phone ? styles.footPhone : day ? styles.footTabletNow : styles.footTablet}>
          {day ? (
            <NowBlock moment={moment} wide={!phone} />
          ) : phone ? (
            <Greeting moment={moment} size={32} sub={16} gap={tokens.spaceSm} />
          ) : (
            <Greeting moment={moment} size={46} sub={19} gap={tokens.spaceMd} />
          )}
        </View>
      </Animated.View>
    </View>
  );
}

/** The upright iPad's top row: the opener keeps to the left of the centred capsule, its name wrapping rather than running under it. */
function TabletTop({ top, onTab }: { top: number; onTab: (tab: Tab) => void }) {
  const [row, setRow] = useState<number>();
  const [capsule, setCapsule] = useState<number>();
  const room =
    row == null || capsule == null
      ? undefined
      : Math.max(0, (row - capsule) / 2 - tokens.space3xl - tokens.spaceSm);

  return (
    <View
      style={[styles.topTablet, { marginTop: top }]}
      onLayout={(event) => setRow(event.nativeEvent.layout.width)}
    >
      <OrgButton maxWidth={room} />
      <View style={styles.grow} />
      <BellButton />
      <View style={styles.capsuleAt} pointerEvents="box-none">
        <View onLayout={(event) => setCapsule(event.nativeEvent.layout.width)}>
          <TabCapsule onTab={onTab} />
        </View>
      </View>
    </View>
  );
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

  return (
    <View style={[styles.band, { height: top + bandBody(moment, layout) }]}>
      {now == null ? (
        <>
          <Cover pieces={[]} shade="foot" />
          <View style={[styles.pieces, { top, bottom: 0 }]}>
            <Confetti pieces={phone ? BAND_PIECES : TABLET_BAND_PIECES} />
          </View>
        </>
      ) : (
        <EventMesh event={now.event} shade="day" />
      )}
      <View style={[phone ? styles.topPhone : styles.topTablet, { marginTop: top }]}>
        <OrgButton compact />
        <View style={styles.grow} />
        <BellButton />
        <View style={phone ? styles.bandTitle : styles.capsuleAt} pointerEvents="box-none">
          {phone ? (
            <Text size={17} weight="semibold" accessibilityRole="header" style={styles.white}>
              {t('todayScreen.today')}
            </Text>
          ) : (
            <TabCapsule onTab={onTab} />
          )}
        </View>
      </View>
      {now != null && (
        <View style={styles.bandNow}>
          <View style={styles.liveDot} />
          <Text size={13.5} weight="semibold" numberOfLines={1} style={styles.white}>
            {moment.full
              ? t('todayScreen.nowLine', { happening: now.happening, until: now.until })
              : t('todayScreen.liveName', { name: now.name })}
          </Text>
        </View>
      )}
    </View>
  );
}

const TAB_LABEL = 12;
// Past 20 a label's line no longer fits under the glyph in the 54 tab (sc-37298).
const TAB_LABEL_MOST = 20;

export function TabBar<T extends string>({
  tabs,
  bottom,
  onTab,
  at,
  say = (tab) => tab,
  ids,
}: {
  tabs: readonly (readonly [T, GlyphName])[];
  bottom: number;
  onTab: (tab: T) => void;
  at: T;
  say?: (tab: T, glyph: GlyphName) => string;
  ids?: Partial<Record<T, string>>;
}) {
  const { fontScale } = useWindowDimensions();
  const words = useWholeWords(
    TAB_LABEL,
    Math.min(TAB_LABEL * fontScale, TAB_LABEL_MOST),
    tabs.map(([label, glyph]) => say(label, glyph)),
    { weight: 'semibold' },
  );

  return (
    <View style={[styles.tabBar, { bottom }]} accessibilityRole="tablist">
      {words.measure}
      {tabs.map(([label, glyph], index) => {
        const on = label === at;
        const ink = on ? tokens.colorAccent : tokens.colorInkSecondary;

        return (
          <Pressable
            key={label}
            onPress={() => onTab(label)}
            style={[styles.tab, on && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={say(label, glyph)}
            testID={ids?.[label] ?? `tab-${label.toLowerCase()}`}
            onLayout={
              index === 0 ? (event) => words.room(event.nativeEvent.layout.width) : undefined
            }
          >
            <Glyph name={glyph} size={22} ink={ink} />
            <Text
              size={TAB_LABEL}
              weight={on ? 'semibold' : 'medium'}
              maxFontSizeMultiplier={words.maxFontSizeMultiplier}
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

/** An upright iPad's tab bar on white, centred at the top of the page. */
export function WhiteCapsule<T extends string>({
  tabs,
  onTab,
  at,
  say = (tab) => tab,
  ids,
}: {
  tabs: readonly (readonly [T, GlyphName])[];
  onTab: (tab: T) => void;
  at: T;
  say?: (tab: T, glyph: GlyphName) => string;
  ids?: Partial<Record<T, string>>;
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
            <Text size={15} weight="semibold" accessible={false} style={{ color: ink }}>
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
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  whiteCapsule: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceHair,
    paddingHorizontal: tokens.spaceXxs,
    borderRadius: 23,
    backgroundColor: tokens.colorInset,
  },
  whiteCapsuleTab: {
    height: 38,
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
  glass: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  glassFill: { backgroundColor: tokens.colorInkOnDark, opacity: 0.22 },
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
  capsule: { paddingHorizontal: tokens.spaceXxs, gap: tokens.spaceHair },
  capsuleTab: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: 13,
    paddingRight: tokens.spaceXl,
    borderRadius: 19,
  },
  capsuleOn: { backgroundColor: tokens.colorCard },
  capsuleAt: { position: 'absolute', left: 0, right: 0, top: 7, alignItems: 'center' },
  eyebrow: { letterSpacing: 12 * 0.08, opacity: 0.92 },
  subLine: { flexDirection: 'row', flexWrap: 'wrap' },
  whiteButton: {
    height: tokens.sizeHitPhoneHero,
    borderRadius: tokens.sizeHitPhoneHero / 2,
    backgroundColor: tokens.colorCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: 22,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  chip: {
    height: tokens.space4xl,
    paddingHorizontal: 12,
    borderRadius: tokens.spacePillEnd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    flexShrink: 1,
  },
  chipLight: { backgroundColor: tokens.colorCard, flexShrink: 0 },
  chipDark: { backgroundColor: tokens.scrimDialog },
  liveRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorBrokenTint,
  },
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
  wideRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 36 },
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
    paddingHorizontal: tokens.spaceXl,
  },
  topTablet: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: tokens.spaceMd,
    paddingHorizontal: tokens.space3xl,
  },
  footPhone: { marginHorizontal: tokens.spaceXxl, marginBottom: SHEET_RISE + 22 },
  footTablet: { marginHorizontal: tokens.space5xl, marginBottom: SHEET_RISE + 30, maxWidth: 620 },
  footTabletNow: { marginHorizontal: tokens.space5xl, marginBottom: SHEET_RISE + tokens.space4xl },
  banner: { borderRadius: tokens.space4xl, overflow: 'hidden' },
  bannerBell: { position: 'absolute', right: tokens.spaceXxl, top: 18 },
  bannerGreeting: { position: 'absolute', left: 30, bottom: tokens.space4xl, maxWidth: 520 },
  bannerNow: { position: 'absolute', left: tokens.space4xl, right: tokens.space4xl, bottom: 26 },
  band: { overflow: 'hidden' },
  bandTitle: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
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
    left: 18,
    right: 18,
    height: PHONE_TAB_BAR,
    padding: 5,
    borderRadius: tokens.space5xl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    flexDirection: 'row',
    gap: tokens.spaceHair,
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
});
