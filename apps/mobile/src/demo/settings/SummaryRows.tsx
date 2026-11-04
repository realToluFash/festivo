import type { ReactNode, Ref } from 'react';
import {
  type AccessibilityRole,
  type AccessibilityState,
  Pressable,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph, type GlyphName } from '../Glyph.tsx';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** A state shape, always beside its word: a tick, a ring, a half ring, two bars, a ring struck through. */
export type MarkKind = 'yes' | 'notyet' | 'waiting' | 'paused' | 'ended';
export type TagKind = MarkKind | 'now';

const TAGS: Record<TagKind, { fill: string; ink: string; ring?: string }> = {
  yes: { fill: tokens.colorCard, ink: tokens.colorInk, ring: tokens.colorBorder },
  notyet: { fill: tokens.colorNeutralFill, ink: tokens.colorInkSecondary },
  waiting: { fill: tokens.colorAttentionTint, ink: tokens.colorAttentionText },
  paused: { fill: tokens.colorNeutralFill, ink: tokens.colorInkSecondary },
  ended: { fill: tokens.colorNeutralFill, ink: tokens.colorInkSecondary },
  now: { fill: tokens.colorAccentTint, ink: tokens.colorAccentText },
};

export function StatusMark({
  kind,
  side = 12,
  ink,
}: {
  kind: MarkKind;
  side?: number;
  ink: string;
}) {
  const round = { width: side, height: side, borderRadius: side / 2 };

  if (kind === 'yes')
    return (
      <View {...hidden} style={[styles.markYes, round]}>
        <Glyph name="tick" size={Math.round(side * 0.7)} ink={tokens.marks.done.ink} weight={3.4} />
      </View>
    );
  if (kind === 'paused') {
    const bar = {
      width: Math.max(3, Math.round(side * 0.24)),
      height: Math.round(side * 0.82),
      backgroundColor: ink,
    };

    return (
      <View
        {...hidden}
        style={[styles.markBars, round, { gap: Math.max(2, Math.round(side * 0.18)) }]}
      >
        <View style={[styles.bar, bar]} />
        <View style={[styles.bar, bar]} />
      </View>
    );
  }

  return (
    <View {...hidden} style={[styles.markRing, round, { borderColor: ink }]}>
      {kind === 'waiting' && <View style={[styles.halfFill, { backgroundColor: ink }]} />}
      {kind === 'ended' && (
        <View style={[styles.dash, { width: Math.round(side * 0.46), backgroundColor: ink }]} />
      )}
    </View>
  );
}

/** Beside a title, only when the state is not the rule: a 12 pt shape and its word on a tint. */
export function Tag({ kind, word }: { kind: TagKind; word: string }) {
  const look = TAGS[kind];

  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: look.fill, paddingLeft: kind === 'now' ? 9 : 7 },
        look.ring != null && { borderWidth: 1, borderColor: look.ring },
      ]}
    >
      {kind !== 'now' && <StatusMark kind={kind} ink={look.ink} />}
      <Text size={12.5} weight="semibold" numberOfLines={1} style={{ color: look.ink }}>
        {word}
      </Text>
    </View>
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
  line?: string | undefined;
  lead?: ReactNode;
  tag?: { kind: TagKind; word: string } | null | undefined;
  opens?: boolean;
  value?: string;
  trail?: ReactNode;
  accent?: boolean;
  weight?: 'semibold' | 'medium';
  selected?: boolean;
  gutter?: number;
  selectable?: boolean;
  onPress?: (() => void) | undefined;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  testID?: string | undefined;
  ref?: Ref<ViewInstance>;
}

/** B's one row: a face or an icon, the title with its tag, a line under it, and a chevron when it opens something. */
export function Row({
  title,
  line,
  lead,
  tag,
  opens = false,
  value,
  trail,
  accent = false,
  weight = 'semibold',
  selected = false,
  gutter = 0,
  selectable = false,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  testID,
  ref,
}: RowProps) {
  const pressed = onPress != null;
  const ring = selected ? 2 : 0;
  const box = [
    styles.row,
    {
      minHeight: line == null ? 52 : 64,
      paddingVertical: 11 - ring,
      paddingHorizontal: gutter - ring,
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
            selectable={selectable}
            accessible={pressed ? false : undefined}
            style={[styles.title, (accent || selected) && styles.accent]}
          >
            {title}
          </Text>
          {tag != null && <Tag kind={tag.kind} word={tag.word} />}
        </View>
        {line != null && (
          <Text
            size={14}
            weight="medium"
            accessible={pressed ? false : undefined}
            style={styles.secondary}
          >
            {line}
          </Text>
        )}
      </View>
      {value != null && (
        <Text
          size={15}
          weight="medium"
          accessible={pressed ? false : undefined}
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
      <View ref={ref} style={box} testID={testID}>
        {words}
      </View>
    );

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed: down }) => [...box, down && !selected && styles.rowPressed]}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState ?? (selected ? { selected } : undefined)}
      accessibilityLabel={
        accessibilityLabel ?? [title, tag?.word, line, value].filter(Boolean).join('. ')
      }
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

/** B's action: Violet text, or red for anything that removes, with what it does on the line under it. */
export function TextAction({
  label,
  onPress,
  removes = false,
  off = false,
  glyph,
  after,
  consequence,
  accessibilityLabel,
  testID,
  ref,
}: {
  label: string;
  onPress: () => void;
  removes?: boolean;
  off?: boolean;
  glyph?: GlyphName;
  after?: GlyphName;
  consequence?: string;
  accessibilityLabel?: string;
  testID?: string | undefined;
  ref?: Ref<ViewInstance>;
}) {
  const ink = off ? tokens.colorInkTertiary : removes ? tokens.colorBroken : tokens.colorAccentText;
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
      <Text size={15} weight="semibold" accessible={false} style={{ color: ink }}>
        {label}
      </Text>
      {after != null && <Glyph name={after} size={16} ink={ink} weight={2.4} />}
    </Pressable>
  );

  if (consequence == null) return action;

  return (
    <View>
      {action}
      <Text size={14} weight="medium" style={styles.secondary}>
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
  pressed: { opacity: tokens.opacityPressed },
  markYes: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.marks.done.fill,
  },
  markBars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  bar: { borderRadius: 1.5 },
  markRing: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  halfFill: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%' },
  dash: { height: 2, borderRadius: 1 },
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
  head: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headTitle: { flex: 1, minWidth: 0, letterSpacing: -0.18 },
  foot: { paddingTop: tokens.spaceXs },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  rowSelected: {
    borderRadius: tokens.spaceXl,
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  rowPressed: { opacity: tokens.opacityPressed },
  words: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 8,
    rowGap: 4,
  },
  title: { flexShrink: 1 },
  hairline: { height: 1, backgroundColor: tokens.colorBorder },
  action: {
    minHeight: tokens.sizeHit,
    minWidth: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
  },
});
