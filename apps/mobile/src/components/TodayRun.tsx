import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text, type TextProps } from './Text.tsx';
import { CappedWholeWords } from './Title.tsx';
import { Glass } from './Glass.tsx';
import { Glyph } from './Glyph.tsx';
import { readOut } from './ReadOut.tsx';
import { tokens } from '../theme/tokens.ts';
import { LABEL_LINE, dotKept, wholeLineHeight } from '../layout/textSize.ts';
import { dayChipRoom, liveChipRoom, openRoom } from '../layout/liveCoverFit.ts';
import type { Now } from '../kit/today.ts';
import { railLabels, type RunNow } from '../kit/todayRun.ts';

const LONG = 40;

export function WhiteButton({
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
      style={({ pressed }) => [
        styles.whiteButton,
        styles.whiteFixed,
        pressed && styles.pressed,
        style,
      ]}
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

/** With `grows`, upright and on the phone from AX1: each chip grows to hold its words at main's size, the day's wrapping only between words with its dot kept on the word before, and taking the line under Live now where both do not fit side by side (sc-93211). */
export function Chips({ now, grows = false }: { now: Now; grows?: boolean }) {
  const { t } = useTranslation();
  const height = grows ? styles.chipGrows : styles.chipFixed;

  return (
    <View style={styles.chips}>
      <View style={[styles.chip, styles.chipLight, height]}>
        <View style={styles.liveRing}>
          <View style={styles.liveDot} />
        </View>
        <Text size={13} weight="semibold" wholeLines={grows} style={grows && styles.shrink}>
          {t('todayScreen.liveNow')}
        </Text>
      </View>
      <View style={[styles.chip, styles.chipDark, height]}>
        {grows ? (
          <Text size={13} weight="semibold" wholeLines style={[styles.white, styles.shrink]}>
            {dotKept(now.live)}
          </Text>
        ) : (
          <Text size={13} weight="semibold" style={styles.white} numberOfLines={1}>
            {now.live}
          </Text>
        )}
      </View>
    </View>
  );
}

/** From AX1, a line of the live cover on its side: no larger than `under`, wrapping between words, stepping down only until its widest word fits `room`, never under `size` (sc-92312). */
export function CoverLine({
  size,
  line,
  room,
  under,
  onDrawn,
  children,
  ...look
}: TextProps & {
  size: number;
  line: number;
  room: number;
  under?: number | undefined;
  onDrawn?: ((size: number) => void) | undefined;
  children: string;
}) {
  const [drawn, setDrawn] = useState<number | null>(null);
  const report = useCallback(
    (at: number) => {
      setDrawn(at);
      onDrawn?.(at);
    },
    [onDrawn],
  );

  return (
    <CappedWholeWords
      {...look}
      size={size}
      room={room}
      under={under}
      breakAfterHyphens
      onDrawn={report}
      style={[look.style, drawn != null && { lineHeight: wholeLineHeight(size, drawn, line) }]}
    >
      {children}
    </CappedWholeWords>
  );
}

/** The chips from AX1: each grows to hold its words and steps alone, no larger than the name, and the day's takes the line under Live now where both do not fit side by side (sc-92312). */
export function WholeChips({ now, column, under }: { now: Now; column: number; under: number }) {
  const { t } = useTranslation();

  return (
    <View style={styles.chips}>
      <View style={[styles.chip, styles.chipLight, styles.chipGrows]}>
        <View style={styles.liveRing}>
          <View style={styles.liveDot} />
        </View>
        <CoverLine
          size={13}
          line={LABEL_LINE}
          weight="semibold"
          room={liveChipRoom(column)}
          under={under}
          style={styles.shrink}
        >
          {t('todayScreen.liveNow')}
        </CoverLine>
      </View>
      <View style={[styles.chip, styles.chipDark, styles.chipGrows]}>
        <CoverLine
          size={13}
          line={LABEL_LINE}
          weight="semibold"
          room={dayChipRoom(column)}
          under={under}
          style={[styles.white, styles.shrink]}
        >
          {now.live}
        </CoverLine>
      </View>
    </View>
  );
}

/** The white button from AX1: it grows to hold its label, which steps alone, no larger than the name (sc-92312). */
export function WholeWhiteButton({
  label,
  onPress,
  column,
  under,
}: {
  label: string;
  onPress: () => void;
  column: number;
  under: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.whiteButton, styles.whiteGrows, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <CoverLine
        size={16}
        line={LABEL_LINE}
        weight="semibold"
        accessible={false}
        room={openRoom(column)}
        under={under}
        style={styles.shrink}
      >
        {label}
      </CoverLine>
      <Glyph name="arrow" ink={tokens.colorInk} />
    </Pressable>
  );
}

function Rail({ run }: { run: RunNow }) {
  const [width, setWidth] = useState(0);
  const boxes = railLabels(run.rail.length, width, tokens.spaceXxs);
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
              key={index}
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
            <View key={index} style={[styles.railLabel, boxes[index]]}>
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

function NextRow({ run, aside }: { run: RunNow; aside: ReactNode }) {
  const { t } = useTranslation();

  if (run.next == null) return <>{aside}</>;

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
      {aside}
    </View>
  );
}

/** sc-4028's crossed-out signal, so one state has one shape. Its words are said once as it appears, never again while they stay the same. */
function AsOfLine({ words }: { words: string }) {
  useEffect(() => readOut(words), [words]);

  return (
    <View style={styles.asOf}>
      <Svg
        width={16}
        height={16}
        viewBox="0 0 16 16"
        fill="none"
        stroke={tokens.colorInkOnDark}
        strokeWidth={1.5}
        strokeLinecap="round"
        style={styles.asOfMark}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Path d="M1.5 6a9.5 9.5 0 0 1 13 0M3.8 8.6a6.2 6.2 0 0 1 8.4 0M6.1 11.1a2.9 2.9 0 0 1 3.8 0" />
        <Path d="M2 2l12 12" />
      </Svg>
      <Text size={14} weight="semibold" style={[styles.white, styles.shrink]}>
        {words}
      </Text>
    </View>
  );
}

function Head({
  name,
  run,
  wide,
  asOf,
}: {
  name: string;
  run: RunNow;
  wide: boolean;
  asOf: string | null;
}) {
  const long = run.headline.length > LONG;
  const size = wide ? (long ? 40 : 58) : long ? 30 : 44;

  return (
    <View style={styles.gapSm}>
      <Text size={15} weight="semibold" style={styles.white}>
        {name}
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
            <Text
              size={16}
              weight="semibold"
              style={styles.white}
              accessibilityLabel={run.untilSaid}
            >
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
      {asOf != null && <AsOfLine words={asOf} />}
    </View>
  );
}

/** Now on the day from the run of show (sc-29875): what is on and until when, the figure, the rail, Next and Open run of show; and how old it is once its reads stop landing (sc-62416). */
export function RunNowBlock({
  now,
  run,
  asOf = null,
  wide,
  aside,
  onOpen,
}: {
  now: Now;
  run: RunNow;
  /** "Offline · as of 16:38", or null while the last landed read is 60 seconds old or less, or none has failed since. */
  asOf?: string | null;
  wide: boolean;
  /** Beside Next: sc-29978's arrived figure, where it shows one. */
  aside?: ReactNode;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const open = <WhiteButton label={t('todayScreen.openRunOfShow')} onPress={onOpen} />;

  return wide ? (
    <View style={styles.gapXl}>
      <View style={styles.wideRow}>
        <View style={[styles.grow, styles.gapLg]}>
          <Chips now={now} />
          <Head name={now.name} run={run} wide asOf={asOf} />
        </View>
        <View style={styles.right}>
          <NextRow run={run} aside={aside} />
          {open}
        </View>
      </View>
      <Rail run={run} />
    </View>
  ) : (
    <View style={styles.gapLg}>
      <Chips now={now} />
      <Head name={now.name} run={run} wide={false} asOf={asOf} />
      <Rail run={run} />
      <NextRow run={run} aside={aside} />
      {open}
    </View>
  );
}

const styles = StyleSheet.create({
  asOf: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  asOfMark: { marginTop: 2 },
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  white: { color: tokens.colorInkOnDark },
  soft: { opacity: 0.84 },
  figures: { fontVariant: ['tabular-nums'] },
  gapSm: { gap: tokens.spaceSm },
  gapLg: { gap: tokens.spaceXl },
  gapXl: { gap: 22 },
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
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXl },
  next: { flex: 1, gap: 3 },
  nextLabel: { letterSpacing: 12 * 0.08 },
  nextLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 5 },
  wideRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 36 },
  right: { width: 340, gap: 18 },
  whiteButton: {
    borderRadius: tokens.sizeHitPhoneHero / 2,
    backgroundColor: tokens.colorCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: 22,
  },
  whiteFixed: { height: tokens.sizeHitPhoneHero },
  whiteGrows: {
    minHeight: tokens.sizeHitPhoneHero,
    paddingVertical: tokens.spaceSm,
    maxWidth: '100%',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  chipFixed: { height: tokens.space4xl },
  chipGrows: {
    minHeight: tokens.space4xl,
    paddingVertical: tokens.spaceXxs,
    maxWidth: '100%',
    flexShrink: 1,
  },
  chip: {
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
  pressed: { opacity: 0.8 },
});
