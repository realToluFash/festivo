import type { ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '../components/Text.tsx';
import { tokens } from '../theme/tokens.ts';
import { Confetti, Cover, type Piece } from '../components/Cover.tsx';
import { EventMesh } from './Cover.tsx';
import { Glyph } from './Glyph.tsx';
import type { Moment, Now } from './today.ts';
import type { Tell } from './TodayParts.tsx';
import { SAMPLE } from './samples.ts';

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

export function Glass({
  children,
  height = 40,
  style,
}: {
  children: ReactNode;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.glass, { height, borderRadius: height / 2 }, style]}>
      <View style={[StyleSheet.absoluteFill, styles.glassFill]} />
      {children}
    </View>
  );
}

function OrgTileWhite({ side = 28 }: { side?: number }) {
  return (
    <View
      style={[styles.orgTile, { width: side, height: side, borderRadius: Math.round(side * 0.32) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text size={Math.round(side * 0.4)} weight="bold" accessible={false} style={styles.accent}>
        IE
      </Text>
    </View>
  );
}

export function OrgButton({ compact = false, tell }: { compact?: boolean; tell: Tell }) {
  return (
    <Pressable
      onPress={() => tell('Switching organisation has its own design.')}
      accessibilityRole="button"
      accessibilityLabel={`${SAMPLE.organisation}. Switch organisation`}
      hitSlop={tokens.spaceXxs}
    >
      {compact ? (
        <Glass style={styles.orgCompact}>
          <OrgTileWhite side={30} />
        </Glass>
      ) : (
        <Glass style={styles.orgWide}>
          <OrgTileWhite />
          <Text size={15} weight="semibold" accessible={false} style={styles.white}>
            {SAMPLE.organisation}
          </Text>
          <Glyph name="updown" size={14} ink={tokens.colorInkOnDark} />
        </Glass>
      )}
    </Pressable>
  );
}

export function BellButton({ tell }: { tell: Tell }) {
  return (
    <Pressable
      onPress={() => tell('Notifications have their own design.')}
      accessibilityRole="button"
      accessibilityLabel="Notifications, 3 unread"
      hitSlop={tokens.spaceXxs}
    >
      <Glass style={styles.bell}>
        <Glyph name="bell" size={19} ink={tokens.colorInkOnDark} />
        <View style={styles.unread} />
      </Glass>
    </Pressable>
  );
}

/** iPadOS 26's tab bar, in glass at the top of the cover. */
export function TabCapsule({ onTab, at = 'Today' }: { onTab: (tab: Tab) => void; at?: Tab }) {
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
            accessibilityLabel={label}
          >
            <Glyph name={glyph} ink={ink} />
            <Text size={15} weight="semibold" accessible={false} style={{ color: ink }}>
              {label}
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
  return (
    <View style={styles.chips}>
      <View style={[styles.chip, styles.chipLight]}>
        <View style={styles.liveRing}>
          <View style={styles.liveDot} />
        </View>
        <Text size={13} weight="semibold">
          Live now
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
  return (
    <View style={styles.nextRow}>
      <View style={styles.next}>
        <Text size={12} weight="bold" style={[styles.white, styles.soft, styles.nextLabel]}>
          NEXT
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
            arrived
          </Text>
        </View>
      </View>
    </View>
  );
}

export function NowBlock({ moment, wide, tell }: { moment: Moment; wide: boolean; tell: Tell }) {
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
      <WhiteButton label="Open the event" onPress={() => tell(`${now.name} has its own design.`)} />
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
      label="Open run of show"
      onPress={() => tell('The run of show has its own design.')}
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
  tell,
  onTab,
  words = 1,
}: {
  moment: Moment;
  layout: CoverLayout;
  top: number;
  tell: Tell;
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
          <BellButton tell={tell} />
        </View>
        <View style={day ? styles.bannerNow : styles.bannerGreeting}>
          {day ? (
            <NowBlock moment={moment} wide tell={tell} />
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
        <View style={[phone ? styles.topPhone : styles.topTablet, { marginTop: top }]}>
          <OrgButton tell={tell} />
          <View style={styles.grow} />
          <BellButton tell={tell} />
          {!phone && (
            <View style={styles.capsuleAt} pointerEvents="box-none">
              <TabCapsule onTab={onTab} />
            </View>
          )}
        </View>
        <View style={[styles.grow, { minHeight: footClear(moment, phone) }]} />
        <View style={phone ? styles.footPhone : day ? styles.footTabletNow : styles.footTablet}>
          {day ? (
            <NowBlock moment={moment} wide={!phone} tell={tell} />
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

export function Band({
  moment,
  layout,
  top,
  tell,
  onTab,
}: {
  moment: Moment;
  layout: Exclude<CoverLayout, 'landscape'>;
  top: number;
  tell: Tell;
  onTab: (tab: Tab) => void;
}) {
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
        <OrgButton compact tell={tell} />
        <View style={styles.grow} />
        <BellButton tell={tell} />
        <View style={phone ? styles.bandTitle : styles.capsuleAt} pointerEvents="box-none">
          {phone ? (
            <Text size={17} weight="semibold" accessibilityRole="header" style={styles.white}>
              Today
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
            {moment.full ? `Now · ${now.happening}, ${now.until}` : `Live · ${now.name}`}
          </Text>
        </View>
      )}
    </View>
  );
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
  return (
    <View style={[styles.tabBar, { bottom }]} accessibilityRole="tablist">
      {TABS.map(([label, glyph]) => {
        const on = label === at;
        const ink = on ? tokens.colorAccent : tokens.colorInkSecondary;

        return (
          <Pressable
            key={label}
            onPress={() => onTab(label)}
            style={[styles.tab, on && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
          >
            <Glyph name={glyph} size={22} ink={ink} />
            <Text
              size={12}
              weight={on ? 'semibold' : 'medium'}
              accessible={false}
              style={{ color: ink }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
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
  orgWide: { gap: tokens.spaceSm, paddingLeft: tokens.spaceXs, paddingRight: tokens.spaceLg },
  orgCompact: { paddingHorizontal: 5 },
  orgTile: {
    backgroundColor: tokens.colorInkOnDark,
    alignItems: 'center',
    justifyContent: 'center',
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
    height: 64,
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
