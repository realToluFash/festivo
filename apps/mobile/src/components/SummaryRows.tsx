import { type ReactNode, type Ref, useEffect, useState } from 'react';
import {
  type AccessibilityRole,
  type AccessibilityState,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from './Text.tsx';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { type MarkKind, ShapeMark } from './StatusMark.tsx';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

export type TagKind = MarkKind | 'now';
export interface RowTag {
  kind: TagKind;
  word: string;
  turning?: boolean;
}

const TAGS: Record<TagKind, { fill: string; ink: string; ring?: string }> = {
  yes: { fill: tokens.colorCard, ink: tokens.colorInk, ring: tokens.colorBorder },
  notyet: { fill: tokens.colorNeutralFill, ink: tokens.colorInkSecondary },
  waiting: { fill: tokens.colorAttentionTint, ink: tokens.colorAttentionText },
  paused: { fill: tokens.colorNeutralFill, ink: tokens.colorInkSecondary },
  ended: { fill: tokens.colorNeutralFill, ink: tokens.colorInkSecondary },
  now: { fill: tokens.colorAccentTint, ink: tokens.colorAccentText },
};

/** A selected row's look: Tint at the row's radius, with no ring. */
export const SELECTED_ROW = {
  borderRadius: tokens.radiusRow,
  backgroundColor: tokens.colorAccentTint,
} as const;

const TURN_MS = 900;

/** Something being sent: a 12 pt ring with a quarter turning, still where motion is reduced. */
export function TurningMark({ side = 12 }: { side?: number }) {
  const reduced = useReducedMotion();
  const [turn] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: TURN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();

    return () => loop.stop();
  }, [reduced, turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View {...hidden} style={{ width: side, height: side, transform: [{ rotate }] }}>
      <Svg width={side} height={side} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={9} fill="none" stroke={tokens.colorBorder} strokeWidth={3.4} />
        <Path
          d="M12 3a9 9 0 0 1 9 9"
          fill="none"
          stroke={tokens.colorInkSecondary}
          strokeWidth={3.4}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

/** Beside a title, only when the state is not the rule: a 12 pt shape and its word on a tint. */
export function Tag({
  kind,
  word,
  turning = false,
  wraps = false,
}: {
  kind: TagKind;
  word: string;
  turning?: boolean | undefined;
  /** At the largest text a long word wraps inside the tag rather than run past the row. */
  wraps?: boolean;
}) {
  const look = TAGS[kind];

  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: look.fill, paddingLeft: kind === 'now' && !turning ? 9 : 7 },
        turning && styles.tagTurning,
        look.ring != null && { borderWidth: 1, borderColor: look.ring },
        wraps && styles.tagWraps,
      ]}
    >
      {turning && <TurningMark />}
      {kind !== 'now' && <ShapeMark kind={kind} ink={look.ink} />}
      <Text
        size={12.5}
        weight="semibold"
        numberOfLines={wraps ? undefined : 1}
        style={{ color: look.ink }}
      >
        {word}
      </Text>
    </View>
  );
}

export function HeadCount({ text }: { text: string }) {
  return (
    <Text size={14.5} weight="medium" style={[styles.secondary, styles.count]}>
      {text}
    </Text>
  );
}

export function SectionHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.head}>
      <Text size={18} weight="bold" accessibilityRole="header" style={styles.headTitle}>
        {title}
      </Text>
      {right}
    </View>
  );
}

/** A header, its rows flat on white, and the one line the rows need under them. */
export function Section({
  title,
  right,
  foot,
  children,
}: {
  title: string;
  right?: ReactNode;
  foot?: string | undefined;
  children: ReactNode;
}) {
  return (
    <View>
      <SectionHead title={title} right={right} />
      {children}
      {foot != null && (
        <Text size={14} weight="medium" style={[styles.secondary, styles.foot]}>
          {foot}
        </Text>
      )}
    </View>
  );
}

export interface RowProps {
  title: string;
  titleLines?: number | undefined;
  line?: string | undefined;
  /** Under the title in place of a plain line: a line with its own mark. */
  below?: ReactNode;
  lead?: ReactNode;
  tag?: RowTag | null | undefined;
  opens?: boolean;
  value?: string | undefined;
  trail?: ReactNode;
  accent?: boolean;
  off?: boolean;
  weight?: 'semibold' | 'medium';
  selected?: boolean;
  gutter?: number;
  pad?: number;
  selectable?: boolean;
  /** A line under it refuses it: said as a refused field is (sc-30447). */
  invalid?: boolean;
  onPress?: (() => void) | undefined;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  testID?: string | undefined;
  ref?: Ref<ViewInstance> | undefined;
}

/** B's one row: a face or an icon, the title with its tag, a line under it, and a chevron when it opens something. */
export function Row({
  title,
  titleLines,
  line,
  below,
  lead,
  tag,
  opens = false,
  value,
  trail,
  accent = false,
  off = false,
  weight = 'semibold',
  selected = false,
  gutter = 0,
  pad = 11,
  selectable = false,
  invalid = false,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  testID,
  ref,
}: RowProps) {
  const pressed = onPress != null;
  const grouped = pressed || accessibilityLabel != null;
  const box = [
    styles.row,
    {
      minHeight: line == null && below == null ? 52 : 64,
      paddingVertical: pad,
      paddingHorizontal: gutter,
    },
    selected && styles.rowSelected,
  ];
  const words = (
    <>
      {lead}
      <View style={styles.words}>
        <View style={styles.titleRow}>
          <Text
            size={16}
            weight={weight}
            numberOfLines={titleLines}
            selectable={selectable}
            accessible={grouped ? false : undefined}
            style={[styles.title, (accent || selected) && styles.accent, off && styles.off]}
          >
            {title}
          </Text>
          {tag != null && <Tag kind={tag.kind} word={tag.word} turning={tag.turning} />}
        </View>
        {line != null && (
          <Text
            size={14}
            weight="medium"
            accessible={grouped ? false : undefined}
            style={[styles.secondary, styles.line]}
          >
            {line}
          </Text>
        )}
        {below}
      </View>
      {value != null && (
        <Text
          size={15}
          weight="medium"
          accessible={grouped ? false : undefined}
          style={styles.secondary}
        >
          {value}
        </Text>
      )}
      {trail}
      {opens && (
        <Glyph
          name="chevron"
          size={17}
          ink={selected ? tokens.colorAccent : tokens.colorInkTertiary}
          weight={2.3}
        />
      )}
    </>
  );

  if (!pressed)
    return (
      <View
        ref={ref}
        style={box}
        accessible={grouped}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {words}
      </View>
    );

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={off}
      style={({ pressed: down }) => [...box, down && !selected && styles.rowPressed]}
      accessibilityRole={accessibilityRole}
      accessibilityState={
        off
          ? { ...accessibilityState, disabled: true }
          : (accessibilityState ?? (selected ? { selected } : undefined))
      }
      accessibilityLabel={
        accessibilityLabel ?? [title, tag?.word, line, value].filter(Boolean).join('. ')
      }
      aria-invalid={invalid}
      testID={testID}
    >
      {words}
    </Pressable>
  );
}

export interface ListItem {
  key: string;
  row: ReactNode;
  inset?: number;
  selected?: boolean;
}

/** Rows with a hairline between them that starts where the text starts, and none beside a selected row. */
export function RowList({ items, gutter = 0 }: { items: readonly ListItem[]; gutter?: number }) {
  return (
    <View>
      {items.map((item, index) => {
        const before = items[index - 1];
        const rule = before != null && before.selected !== true && item.selected !== true;

        return (
          <View key={item.key}>
            {rule && <View style={[styles.hairline, { marginLeft: (item.inset ?? 0) + gutter }]} />}
            {item.row}
          </View>
        );
      })}
    </View>
  );
}

/** B's action: Violet text, or red for anything that removes, with what it does on the line under it; `plain` is Ink, as Manage's Duplicate and Pause. */
export function TextAction({
  label,
  onPress,
  removes = false,
  plain = false,
  off = false,
  figures = false,
  glyph,
  renderMark,
  after,
  consequence,
  accessibilityLabel,
  testID,
  ref,
}: {
  label: string;
  onPress: () => void;
  removes?: boolean;
  plain?: boolean;
  off?: boolean;
  figures?: boolean;
  glyph?: GlyphName;
  renderMark?: (ink: string) => ReactNode;
  after?: GlyphName;
  consequence?: string;
  accessibilityLabel?: string;
  testID?: string | undefined;
  ref?: Ref<ViewInstance> | undefined;
}) {
  const ink = off
    ? tokens.colorInkTertiary
    : removes
      ? tokens.colorBroken
      : plain
        ? tokens.colorInk
        : tokens.colorAccentText;
  const action = (
    <Pressable
      ref={ref}
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={off ? { disabled: true } : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      {glyph != null && <Glyph name={glyph} size={17} ink={ink} weight={2.3} />}
      {renderMark?.(ink)}
      <Text
        size={15}
        weight="semibold"
        accessible={false}
        style={[{ color: ink }, figures && styles.figures]}
      >
        {label}
      </Text>
      {after != null && <Glyph name={after} size={16} ink={ink} weight={2.4} />}
    </Pressable>
  );

  if (consequence == null) return action;

  return (
    <View>
      {action}
      <Text size={14} weight="medium" style={[styles.secondary, styles.consequence]}>
        {consequence}
      </Text>
    </View>
  );
}

/** A line of words between the blocks, in Ink 2 unless it is the page's own say. */
export function Line({
  text,
  quiet = true,
  size = 15,
}: {
  text: string;
  quiet?: boolean;
  size?: number;
}) {
  return (
    <Text size={size} weight="medium" style={quiet ? styles.secondary : undefined}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  off: { color: tokens.colorInkTertiary },
  pressed: { opacity: tokens.opacityPressed },
  tag: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
    gap: 5,
    paddingRight: 9,
    borderRadius: 12,
  },
  tagTurning: { gap: tokens.spaceXs },
  tagWraps: { flexShrink: 1 },
  head: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headTitle: { flex: 1, minWidth: 0, letterSpacing: -0.18, lineHeight: 18 * 1.25 },
  foot: { paddingTop: tokens.spaceXs },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  // Lit like People's row, with no ring: the owner found the ring weird (6 Nov 2026).
  rowSelected: SELECTED_ROW,
  rowPressed: { opacity: tokens.opacityPressed },
  words: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 8,
    rowGap: 4,
  },
  title: { flexShrink: 1, lineHeight: 16 * 1.3 },
  line: { lineHeight: 14 * 1.4 },
  consequence: { lineHeight: 14 * 1.45 },
  count: { fontVariant: ['tabular-nums'] },
  hairline: { height: 1, backgroundColor: tokens.colorBorder },
  figures: { fontVariant: ['tabular-nums'] },
  action: {
    minHeight: tokens.sizeHit,
    minWidth: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
  },
});
