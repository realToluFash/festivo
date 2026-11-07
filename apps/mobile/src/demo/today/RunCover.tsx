import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { EventMesh } from '../../components/EventMesh.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import {
  BellButton,
  bandBody,
  type CoverLayout,
  coverBody,
  Glass,
  OrgButton,
  SHEET_RISE,
  type Tab,
  TabCapsule,
} from '../../components/TodayCover.tsx';
import { useTodayShell } from '../../components/todayShell.ts';
import type { Now } from '../../kit/today.ts';
import { tokens } from '../../theme/tokens.ts';
import { type RunMoment, type RunNow, railLabels } from './runOfShow.ts';

const LONG = 40;

function WhiteButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.whiteButton, pressed && styles.pressed]}
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

function Rail({ run }: { run: RunNow }) {
  const [width, setWidth] = useState(0);
  const boxes = railLabels(run.rail.length, width, RAIL_LABEL, tokens.spaceXxs);
  const last = Math.max(1, run.rail.length - 1);
  const on = run.rail.findIndex((stop) => stop.state === 'now');
  const reached = run.rail.reduce(
    (far, stop, index) => (stop.state === 'done' || stop.state === 'now' ? index : far),
    -1,
  );
  const at = (index: number) => `${(index / last) * 100}%` as const;

  return (
    <View style={styles.rail} accessible accessibilityLabel={run.railSaid}>
      <View style={styles.railLine}>
        <View style={[styles.railTrack, styles.railFaint]} />
        {reached > 0 && <View style={[styles.railTrack, { width: at(reached) }]} />}
        {run.rail.map((stop, index) =>
          stop.state === 'now' ? null : (
            <View
              key={stop.time}
              style={[
                styles.node,
                { left: at(index) },
                stop.state === 'done' ? styles.nodeDone : styles.nodeLater,
                stop.state === 'next' && styles.nodeNext,
              ]}
            />
          ),
        )}
        {on >= 0 && (
          <>
            <View style={[styles.nowGlow, { left: at(on) }]} />
            <View style={[styles.nowNode, { left: at(on) }]} />
          </>
        )}
      </View>
      <View
        style={styles.railLabels}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {run.rail.map((stop, index) => {
          const strong = stop.state === 'now' || stop.state === 'next';
          const end = run.rail.length - 1;
          const align =
            index === 0 ? styles.alignLeft : index === end ? styles.alignRight : styles.alignCentre;

          return width === 0 ? null : (
            <View key={stop.time} style={[styles.railLabel, boxes[index]]}>
              <Text
                size={12}
                weight={strong ? 'semibold' : 'medium'}
                accessible={false}
                numberOfLines={1}
                style={[styles.white, !strong && styles.soft, align]}
              >
                {stop.time}
              </Text>
              <Text
                size={12}
                weight={strong ? 'semibold' : 'medium'}
                accessible={false}
                numberOfLines={1}
                style={[styles.white, !strong && styles.soft, align]}
              >
                {stop.title}
              </Text>
            </View>
          );
        })}
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

function NextAndArrived({ moment }: { moment: RunMoment }) {
  const { t } = useTranslation();
  const { now, run } = moment;

  if (run.next == null) return null;

  return (
    <View style={styles.nextRow}>
      <View style={styles.next}>
        <Text size={12} weight="bold" style={[styles.white, styles.soft, styles.nextLabel]}>
          {t('todayScreen.next').toLocaleUpperCase()}
        </Text>
        <View style={styles.nextLine}>
          <Text size={16} weight="bold" style={[styles.white, styles.figures]}>
            {run.next.time}
          </Text>
          <Text size={16} weight="semibold" style={[styles.white, styles.shrink]}>
            {run.next.title}
          </Text>
        </View>
      </View>
      {moment.arrived && (
        <View
          style={styles.arrived}
          accessible
          accessibilityLabel={`${now.arrived} of ${now.expected} arrived`}
        >
          <Ring share={now.arrived / now.expected} />
          <View>
            <View style={styles.nextLine}>
              <Text
                size={18}
                weight="bold"
                accessible={false}
                style={[styles.white, styles.figures]}
              >
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
            <Text
              size={12.5}
              weight="medium"
              accessible={false}
              style={[styles.white, styles.soft]}
            >
              {t('todayScreen.arrivedCount')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function Head({ moment, wide }: { moment: RunMoment; wide: boolean }) {
  const { now, run } = moment;
  const long = run.headline.length > LONG;
  const size = wide ? (long ? 40 : 58) : long ? 30 : 44;

  return (
    <View style={styles.gapSm}>
      <Text size={15} weight="semibold" style={styles.white}>
        {now.name}
      </Text>
      <Text
        size={size}
        weight="bold"
        accessibilityRole="header"
        style={[styles.white, { letterSpacing: size * -0.02, lineHeight: size * 1.08 }]}
      >
        {run.headline}
      </Text>
      {(run.until != null || run.figure != null) && (
        <View style={styles.until}>
          {run.until != null && (
            <Text size={16} weight="semibold" style={styles.white}>
              {run.until}
            </Text>
          )}
          {run.figure != null && (
            <Glass height={26} style={styles.behind}>
              <Text
                size={13}
                weight="semibold"
                style={styles.white}
                accessibilityLabel={run.figure.said}
              >
                {run.figure.words}
              </Text>
            </Glass>
          )}
        </View>
      )}
    </View>
  );
}

export function RunNowBlock({ moment, wide }: { moment: RunMoment; wide: boolean }) {
  const { t } = useTranslation();
  const { open: go } = useTodayShell();
  const { now } = moment;
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
          <Head moment={moment} wide />
        </View>
        <View style={styles.right}>
          <NextAndArrived moment={moment} />
          {open}
        </View>
      </View>
      <Rail run={moment.run} />
    </View>
  ) : (
    <View style={styles.gapLg}>
      <Chips now={now} />
      <Head moment={moment} wide={false} />
      <Rail run={moment.run} />
      <NextAndArrived moment={moment} />
      {open}
    </View>
  );
}

export function RunCover({
  moment,
  layout,
  top,
  onTab,
  words = 1,
}: {
  moment: RunMoment;
  layout: CoverLayout;
  top: number;
  onTab: (tab: Tab) => void;
  words?: Animated.AnimatedInterpolation<number> | number;
}) {
  if (layout === 'landscape')
    return (
      <View style={[styles.banner, { minHeight: coverBody(moment, layout) }]}>
        <EventMesh event={moment.now.event} shade="day" />
        <View style={styles.bannerBell}>
          <BellButton />
        </View>
        <View style={styles.bannerNow}>
          <RunNowBlock moment={moment} wide />
        </View>
      </View>
    );

  const phone = layout === 'phone';

  return (
    <View style={[styles.cover, { minHeight: top + coverBody(moment, layout) }]}>
      <View style={styles.overscroll} />
      <EventMesh event={moment.now.event} shade="day" />
      <Animated.View style={[styles.coverWords, { opacity: words }]}>
        <View style={[phone ? styles.topPhone : styles.topTablet, { marginTop: top }]}>
          <OrgButton />
          <View style={styles.grow} />
          <BellButton />
          {!phone && (
            <View style={styles.capsuleAt} pointerEvents="box-none">
              <TabCapsule onTab={onTab} />
            </View>
          )}
        </View>
        <View style={[styles.grow, { minHeight: tokens.spaceXl }]} />
        <View style={phone ? styles.footPhone : styles.footTablet}>
          <RunNowBlock moment={moment} wide={!phone} />
        </View>
      </Animated.View>
    </View>
  );
}

export function RunBand({
  moment,
  layout,
  top,
  onTab,
}: {
  moment: RunMoment;
  layout: Exclude<CoverLayout, 'landscape'>;
  top: number;
  onTab: (tab: Tab) => void;
}) {
  const { t } = useTranslation();
  const phone = layout === 'phone';

  return (
    <View style={[styles.band, { height: top + bandBody(moment, layout) }]}>
      <EventMesh event={moment.now.event} shade="day" />
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
      <View style={styles.bandNow}>
        <View style={styles.liveDot} />
        <Text size={13.5} weight="semibold" numberOfLines={1} style={[styles.white, styles.shrink]}>
          {moment.run.band}
        </Text>
      </View>
    </View>
  );
}

const RAIL_LABEL = 64;

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  white: { color: tokens.colorInkOnDark },
  soft: { opacity: 0.84 },
  figures: { fontVariant: ['tabular-nums'] },
  tight: { marginLeft: 1 },
  pressed: { opacity: 0.8 },
  gapSm: { gap: tokens.spaceSm },
  gapLg: { gap: tokens.spaceXl },
  gapXl: { gap: 22 },
  capsuleAt: { position: 'absolute', left: 0, right: 0, top: 7, alignItems: 'center' },
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
  until: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
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
  nodeNext: { opacity: 1 },
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
  railLabels: { height: 34 },
  railLabel: { position: 'absolute' },
  alignLeft: { textAlign: 'left' },
  alignRight: { textAlign: 'right' },
  alignCentre: { textAlign: 'center' },
  ring: { transform: [{ rotate: '-90deg' }] },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXl },
  next: { flex: 1, gap: 3 },
  nextLabel: { letterSpacing: 12 * 0.08 },
  nextLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 5 },
  arrived: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  wideRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 36 },
  right: { width: 340, gap: 18 },
  cover: { overflow: 'visible', backgroundColor: tokens.colorAccent },
  coverWords: { flexGrow: 1 },
  overscroll: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    height: 800,
    backgroundColor: tokens.optionRose,
  },
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
  footTablet: { marginHorizontal: tokens.space5xl, marginBottom: SHEET_RISE + tokens.space4xl },
  banner: { borderRadius: tokens.space4xl, overflow: 'hidden', justifyContent: 'flex-end' },
  bannerBell: { position: 'absolute', right: tokens.spaceXxl, top: 18 },
  bannerNow: { marginHorizontal: tokens.space4xl, marginBottom: 26, marginTop: 76 },
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
});
