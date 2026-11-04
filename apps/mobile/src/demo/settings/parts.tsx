import type { ReactElement, ReactNode, Ref } from 'react';
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph, type GlyphName } from '../Glyph.tsx';
import type { DemoSection, SettingsLayout } from './sample.ts';

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
  full = true,
  height = tokens.sizeHitPhoneHero,
  accessibilityLabel,
  testID,
  ref,
}: {
  label: string;
  kind?: PillKind;
  onPress?: () => void;
  glyph?: GlyphName;
  full?: boolean;
  height?: number;
  accessibilityLabel?: string;
  testID?: string;
  ref?: Ref<ViewInstance>;
}) {
  const look = PILL[kind];
  const off = kind === 'off';

  return (
    <Pressable
      ref={ref}
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.pill,
        {
          height,
          borderRadius: height / 2,
          backgroundColor: look.fill,
          borderWidth: look.ring == null ? 0 : 1.5,
          borderColor: look.ring,
        },
        full ? styles.pillFull : styles.pillFit,
        kind === 'quiet' && styles.pillQuiet,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      {glyph != null && <Glyph name={glyph} size={18} ink={look.ink} weight={2.1} />}
      <Text
        size={height >= tokens.sizeHitPhonePrimary ? 16 : TYPE.body}
        weight="semibold"
        numberOfLines={1}
        accessible={false}
        style={{ color: look.ink }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A pair of choices: on a phone a stack with the confirming one on top, on a tablet a row with the dismissive one first. */
export function Pair({
  layout,
  dismiss,
  confirm,
}: {
  layout: SettingsLayout;
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

export function Back({ label = 'Settings', onPress }: { label?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
    >
      <Glyph name="back" size={18} ink={tokens.colorInk} weight={2.4} />
      <Text size={TYPE.body} weight="semibold" accessible={false}>
        {label}
      </Text>
    </Pressable>
  );
}

export function RoundButton({
  glyph,
  label,
  onPress,
  dot = false,
}: {
  glyph: GlyphName;
  label: string;
  onPress: () => void;
  dot?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={tokens.spaceXxs}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Glyph name={glyph} size={19} ink={tokens.colorInk} />
      {dot && <View style={styles.unread} />}
    </Pressable>
  );
}

type TileOf = Exclude<DemoSection, 'account'> | 'demo';

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
          size={Math.max(12, Math.round(side * 0.36))}
          weight="bold"
          accessible={false}
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
  pressed: { opacity: 0.8 },
  stack: { gap: tokens.spaceMd },
  pairRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.spaceMd,
  },
  back: {
    alignSelf: 'flex-start',
    height: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXxs,
    paddingLeft: tokens.spaceMd,
    paddingRight: tokens.spaceXl,
    borderRadius: tokens.sizeHit / 2,
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
