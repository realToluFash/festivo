import { type ReactElement, type ReactNode, type Ref, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';

import { Text, TitleCap } from './Text.tsx';
import {
  type BackSizing,
  PILL_ABOVE,
  PILL_GAP,
  PILL_LEFT,
  PILL_RIGHT,
  backRoomIsLaid,
  backRoomStands,
  backScale,
  backWordSize,
  pillBack,
} from '../layout/focusedHeader.ts';
import type { Family, WeightName } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';
import { besideGlyph, capInDisc, capUnderTitle, grownPad, wordsIn } from '../layout/textSize.ts';
import { Glyph, type GlyphName } from './Glyph.tsx';
import type { ShellSection } from './settingsShell.ts';
import { TurningMark } from './SummaryRows.tsx';
import { MeasuredWords } from './Title.tsx';
import type { CoverLayout } from './TodayCover.tsx';

export const TYPE = {
  titlePhone: 34,
  titlePortrait: 40,
  titlePane: 28,
  card: 19,
  row: 16,
  body: 15,
  line: 14.5,
  small: 13.5,
  meta: 12.5,
} as const;

export const CARD_RADIUS = tokens.space3xl;

export function Card({
  children,
  gap = 14,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, { gap }, style]}>{children}</View>;
}

export function CardHead({
  title,
  line,
  right,
}: {
  title: string;
  line?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.headWords}>
      <View style={styles.headRow}>
        <Text size={TYPE.card} weight="bold" accessibilityRole="header" style={styles.headTitle}>
          {title}
        </Text>
        {right}
      </View>
      {line != null && (
        <Text size={TYPE.line} weight="medium" style={styles.secondary}>
          {line}
        </Text>
      )}
    </View>
  );
}

export function Caps({ text, top = 0 }: { text: string; top?: number }) {
  return (
    <Text
      size={12}
      weight="semibold"
      accessibilityRole="header"
      style={[styles.caps, { marginTop: top }]}
    >
      {text.toUpperCase()}
    </Text>
  );
}

export type PillKind = 'primary' | 'secondary' | 'danger' | 'dangerQuiet' | 'quiet' | 'off';

const PILL: Record<PillKind, { fill: string; ink: string; ring?: string }> = {
  primary: { fill: tokens.colorAccent, ink: tokens.colorInkOnDark },
  secondary: { fill: tokens.colorCard, ink: tokens.colorInk, ring: tokens.colorBorder },
  danger: { fill: tokens.colorBroken, ink: tokens.colorInkOnDark },
  dangerQuiet: { fill: tokens.colorCard, ink: tokens.colorBroken, ring: tokens.colorBroken },
  quiet: { fill: 'transparent', ink: tokens.colorAccentText },
  off: { fill: tokens.colorNeutralFill, ink: tokens.colorInkSecondary },
};

/** B's buttons: a pill, filled for the one thing to do, outlined in red to open something that cannot be undone. */
export function Pill({
  label,
  kind = 'primary',
  onPress,
  glyph,
  busy = false,
  full = true,
  height = tokens.sizeHitPhoneHero,
  grows = false,
  accessibilityLabel,
  testID,
  ref,
}: {
  label: string;
  kind?: PillKind;
  onPress?: () => void;
  glyph?: GlyphName;
  busy?: boolean;
  full?: boolean;
  height?: number;
  /** At least `height`, and as tall as its words: the label grows with the text size, each word whole (sc-66900). */
  grows?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  ref?: Ref<ViewInstance> | undefined;
}) {
  const look = PILL[busy ? 'off' : kind];
  const off = busy || kind === 'off';
  const textSize = height >= tokens.sizeHitPhonePrimary ? 16 : TYPE.body;
  const ring = look.ring == null ? 0 : 1.5;
  const grown = useGrownLabel({
    on: grows,
    label,
    size: textSize,
    glyph: busy || glyph == null ? 0 : PILL_GLYPH_SIZE / textSize,
    beside: busy ? TURNING_SIDE + tokens.spaceSm : glyph == null ? 0 : tokens.spaceSm,
    chrome: 2 * (tokens.spaceXxl + ring),
  });

  return (
    <Pressable
      ref={ref}
      onPress={off ? undefined : onPress}
      disabled={off}
      onLayout={grows ? (event) => grown.room(event.nativeEvent.layout.width) : undefined}
      style={({ pressed }) => [
        styles.pill,
        grows
          ? [
              styles.pillGrows,
              { minHeight: height, paddingVertical: grownPad(height, textSize, ring) },
            ]
          : { height, borderRadius: height / 2 },
        { backgroundColor: look.fill, borderWidth: ring, borderColor: look.ring },
        full ? styles.pillFull : styles.pillFit,
        kind === 'quiet' && styles.pillQuiet,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      {grown.measure}
      {busy && <TurningMark side={TURNING_SIDE} />}
      {!busy && glyph != null && (
        <Glyph name={glyph} size={PILL_GLYPH_SIZE * grown.glyphScale} ink={look.ink} weight={2.1} />
      )}
      <Text
        size={textSize}
        weight="semibold"
        numberOfLines={grows ? undefined : 1}
        maxFontSizeMultiplier={grows ? grown.multiplier : undefined}
        accessible={false}
        style={[{ color: look.ink }, grows && styles.pillWords]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const PILL_GLYPH_SIZE = 18;
const TURNING_SIDE = 16;

/** A growing pill's label: its full size while its widest word fits beside the glyph, which grows with it; else the largest that fits, never under `size` (sc-13496). */
export function useGrownLabel({
  on,
  label,
  size,
  weight = 'semibold',
  family = 'sans',
  glyph,
  beside,
  chrome,
}: {
  on: boolean;
  label: string;
  size: number;
  weight?: WeightName;
  family?: Family;
  /** The glyph's side per unit of the label's size, 0 when it does not grow. */
  glyph: number;
  /** What sits beside the words at every size: the gap, and a mark that does not grow. */
  beside: number;
  /** The pill's sides and ring. */
  chrome: number;
}) {
  const { fontScale } = useWindowDimensions();
  const cap = useContext(TitleCap);
  const start = size * capUnderTitle(cap ?? Infinity, size, fontScale);
  const key = `${start}|${label}`;
  const words = wordsIn([label]);
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number> }>({
    key: '',
    widths: {},
  });
  const [width, setWidth] = useState<number | null>(null);
  const widths = measured.key === key ? measured.widths : {};
  const known = words.every((word) => widths[word] != null);
  const drawn =
    !on || width == null || !known
      ? start
      : besideGlyph(
          size,
          start,
          Math.max(...words.map((word) => widths[word] ?? 0)),
          glyph,
          width - chrome - beside,
        );

  return {
    measure: on ? (
      <MeasuredWords
        words={words.filter((word) => widths[word] == null)}
        size={size}
        weight={weight}
        family={family}
        maxFontSizeMultiplier={start / size}
        onWidth={(word, measuredWidth) =>
          setMeasured((now) => {
            const kept = now.key === key ? now.widths : {};

            return kept[word] === measuredWidth
              ? now
              : { key, widths: { ...kept, [word]: measuredWidth } };
          })
        }
      />
    ) : null,
    multiplier: drawn / size,
    glyphScale: on ? Math.max(1, Math.min(drawn / size, fontScale)) : 1,
    room: (next: number) => setWidth((now) => (now === next ? now : next)),
  };
}

/** A pair of choices: on a phone a stack with the confirming one on top, on a tablet a row with the dismissive one first. */
export function Pair({
  layout,
  dismiss,
  confirm,
}: {
  layout: CoverLayout;
  dismiss: ReactElement;
  confirm: ReactElement;
}) {
  if (layout === 'phone')
    return (
      <View style={styles.stack}>
        {confirm}
        {dismiss}
      </View>
    );

  return (
    <View style={styles.pairRow}>
      {dismiss}
      {confirm}
    </View>
  );
}

/** A back's word sized by `backWordSize`, measured; the room is relearned when Refreshing… comes or goes beside it (sc-68778), and a room learned stepped down is dropped once the word is remeasured (sc-74113). */
export function useBackWord(word: string, back: BackSizing, besideShown = false) {
  const { width: windowWidth } = useWindowDimensions();
  const key = `${back.full}|${word}`;
  const [width, setWidth] = useState<{ key: string; width: number } | null>(null);
  const roomKey = `${key}|${windowWidth}|${besideShown}`;
  const [room, setRoom] = useState<{
    key: string;
    width: number;
    size: number;
    word: number | null;
  } | null>(null);
  const measured = width?.key === key ? width.width : null;
  const known = room?.key === roomKey && backRoomStands(back, room, measured) ? room.width : null;
  const size = measured == null || known == null ? back.full : backWordSize(back, measured, known);

  return {
    size,
    measure: (
      <MeasuredWords
        words={[word]}
        size={back.full}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(_, drawn) => setWidth({ key, width: drawn })}
      />
    ),
    onLayout: (event: LayoutChangeEvent) => {
      const laid = event.nativeEvent.layout.width;

      if (size === back.full || (measured != null && backRoomIsLaid(back, measured, size, laid)))
        setRoom({ key: roomKey, width: laid, size, word: measured });
    },
  };
}

/** At least 44, a capsule as tall as its word, the ‹ growing with it; a word wider than its room steps down to fit, never below 15 (sc-37903). */
export function Back({
  label,
  onPress,
  off = false,
  besideShown = false,
  testID,
}: {
  label?: string;
  onPress: () => void;
  off?: boolean | undefined;
  besideShown?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const scale = backScale(fontScale, useContext(TitleCap));
  const place = label ?? t('settings.title');
  const back = pillBack(scale);
  const word = useBackWord(place, back, besideShown);

  return (
    <>
      {word.measure}
      <Pressable
        onPress={onPress}
        onLayout={word.onLayout}
        disabled={off}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('frame.backTo', { place })}
        accessibilityState={{ disabled: off }}
        testID={testID}
      >
        <Glyph
          name="back"
          size={(back.glyph / back.least) * word.size}
          ink={off ? tokens.colorInkSecondary : tokens.colorInk}
          weight={2.4}
        />
        <Text
          size={word.size}
          weight="semibold"
          muted={off}
          allowFontScaling={false}
          numberOfLines={1}
          accessible={false}
        >
          {place}
        </Text>
      </Pressable>
    </>
  );
}

export function RoundButton({
  glyph,
  label,
  onPress,
  dot = false,
  testID,
  ref,
}: {
  glyph: GlyphName;
  label: string;
  onPress: () => void;
  dot?: boolean;
  testID?: string | undefined;
  ref?: Ref<ViewInstance> | undefined;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      hitSlop={tokens.spaceXxs}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Glyph name={glyph} size={19} ink={tokens.colorInk} />
      {dot && <View style={styles.unread} />}
    </Pressable>
  );
}

type TileOf = Exclude<ShellSection, 'account' | 'personalisation'> | 'demo';

const TILES: Record<TileOf, { glyph: GlyphName; fill: string }> = {
  security: { glyph: 'shield', fill: tokens.optionTeal },
  notifications: { glyph: 'bell', fill: tokens.optionRose },
  organisation: { glyph: 'settings', fill: tokens.colorAccent },
  members: { glyph: 'users', fill: tokens.optionBlue },
  signInRules: { glyph: 'lock', fill: tokens.optionPurple },
  demo: { glyph: 'sparkle', fill: tokens.colorInk },
};

export function Tile({
  of,
  side = 36,
  initials,
}: {
  of: TileOf;
  side?: number;
  initials?: string | undefined;
}) {
  const tile = TILES[of];

  return (
    <View
      style={[
        styles.tile,
        {
          width: side,
          height: side,
          borderRadius: Math.round(side * 0.3),
          backgroundColor: tile.fill,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {of === 'organisation' && initials != null ? (
        <Text
          size={Math.max(12, Math.round(side * 0.38))}
          weight="bold"
          accessible={false}
          style={styles.white}
        >
          {initials}
        </Text>
      ) : (
        <Glyph
          name={tile.glyph}
          size={Math.round(side * 0.52)}
          ink={tokens.colorInkOnDark}
          weight={2.1}
        />
      )}
    </View>
  );
}

const AVATAR_TONES = [
  { fill: tokens.colorAccentTint, ink: tokens.colorAccentText },
  { fill: tokens.colorAttentionTint, ink: tokens.colorAttentionText },
  { fill: tokens.colorBrokenTint, ink: tokens.colorBrokenText },
  { fill: tokens.colorPausedTint, ink: tokens.colorPausedText },
  { fill: tokens.colorNeutralFill, ink: tokens.colorInk },
] as const;

/** A person's initials in a soft disc, toned by their place in the list, or a glyph when there are none; always beside their name. */
export function Avatar({
  initials,
  side = 40,
  tone = 0,
  glyph,
}: {
  initials: string;
  side?: number;
  tone?: number;
  glyph?: GlyphName | undefined;
}) {
  const look = AVATAR_TONES[tone % AVATAR_TONES.length] ?? AVATAR_TONES[0];
  const size = Math.max(12, Math.round(side * 0.36));

  return (
    <View
      style={[
        styles.avatar,
        { width: side, height: side, borderRadius: side / 2, backgroundColor: look.fill },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {glyph == null ? (
        <Text
          size={size}
          weight="bold"
          accessible={false}
          maxFontSizeMultiplier={capInDisc(side, size)}
          style={{ color: look.ink }}
        >
          {initials}
        </Text>
      ) : (
        <Glyph name={glyph} size={Math.round(side * 0.45)} ink={look.ink} weight={2.2} />
      )}
    </View>
  );
}

export type ChipKind = 'active' | 'pending' | 'suspended' | 'former' | 'built' | 'accent';

/** A state as a shape and a word: a dot for active, a half disc for waiting, two bars for suspended, a ring for gone. */
export function Chip({ word, kind }: { word: string; kind: ChipKind }) {
  const look = {
    active: { fill: tokens.colorCard, ink: tokens.colorInk, ring: tokens.colorBorder },
    pending: { fill: tokens.colorAttentionTint, ink: tokens.colorAttentionText },
    suspended: { fill: tokens.colorNeutralFill, ink: tokens.colorInkSecondary },
    former: { fill: tokens.colorNeutralFill, ink: tokens.colorInkSecondary },
    built: { fill: tokens.colorCard, ink: tokens.colorInkSecondary, ring: tokens.colorBorder },
    accent: { fill: tokens.colorAccentTint, ink: tokens.colorAccentText },
  }[kind];

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: look.fill },
        'ring' in look && { borderWidth: 1, borderColor: look.ring },
      ]}
    >
      <ChipMark kind={kind} />
      <Text size={12.5} weight="semibold" style={{ color: look.ink }}>
        {word}
      </Text>
    </View>
  );
}

function ChipMark({ kind }: { kind: ChipKind }) {
  const hidden = {
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  } as const;

  if (kind === 'active') return <View {...hidden} style={styles.dot} />;
  if (kind === 'pending') return <View {...hidden} style={styles.half} />;
  if (kind === 'suspended')
    return (
      <View {...hidden} style={styles.bars}>
        <View style={styles.bar} />
        <View style={styles.bar} />
      </View>
    );
  if (kind === 'former') return <View {...hidden} style={styles.ring} />;

  return null;
}

export function RowsCard({
  children,
  inset = tokens.spaceXl,
}: {
  children: ReactNode[];
  inset?: number;
}) {
  return (
    <View style={styles.rows}>
      {children.map((child, index) => (
        <View key={index}>
          {index > 0 && <View style={[styles.hairline, { marginLeft: inset }]} />}
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: tokens.spaceXxl,
    borderRadius: CARD_RADIUS,
    backgroundColor: tokens.colorInset,
  },
  headWords: { gap: tokens.spaceXs },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  headTitle: { flex: 1, letterSpacing: TYPE.card * -0.01 },
  secondary: { color: tokens.colorInkSecondary },
  white: { color: tokens.colorInkOnDark },
  caps: {
    color: tokens.colorInkSecondary,
    letterSpacing: 12 * 0.08,
    paddingHorizontal: tokens.spaceXxs,
    marginBottom: tokens.spaceMd,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
  },
  pillFull: { alignSelf: 'stretch', paddingHorizontal: tokens.spaceXxl },
  pillFit: { alignSelf: 'flex-start', paddingHorizontal: 22 },
  pillQuiet: { paddingHorizontal: tokens.spaceXxs, minHeight: tokens.sizeHit },
  pillGrows: { borderRadius: tokens.radiusPill },
  pillWords: { textAlign: 'center' },
  pressed: { opacity: tokens.opacityPressed },
  stack: { gap: tokens.spaceMd },
  pairRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.spaceMd,
  },
  back: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: PILL_GAP,
    paddingVertical: PILL_ABOVE,
    paddingLeft: PILL_LEFT,
    paddingRight: PILL_RIGHT,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
  },
  round: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  unread: {
    position: 'absolute',
    right: 11,
    top: 11,
    width: tokens.spaceSm,
    height: tokens.spaceSm,
    borderRadius: tokens.spaceXxs,
    backgroundColor: tokens.colorBroken,
    borderWidth: 1.5,
    borderColor: tokens.colorInset,
  },
  tile: { alignItems: 'center', justifyContent: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  chip: {
    alignSelf: 'flex-start',
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: 13,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.optionGreen },
  half: {
    width: 10,
    height: 5,
    marginTop: -2,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    backgroundColor: tokens.colorAttention,
  },
  bars: { flexDirection: 'row', gap: 2 },
  bar: { width: 2.5, height: 9, borderRadius: 1, backgroundColor: tokens.colorInkSecondary },
  ring: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 2,
    borderColor: tokens.colorInkSecondary,
  },
  rows: {
    borderRadius: CARD_RADIUS,
    backgroundColor: tokens.colorInset,
    paddingVertical: tokens.spaceXxs,
  },
  hairline: { height: 1, backgroundColor: tokens.colorBorder },
});
