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
import { Glyph } from '../../components/Glyph.tsx';
import { type RowTag, Tag } from '../../components/StateTag.tsx';

export {
  type MarkKind,
  type RowTag,
  ShapeMark as StatusMark,
  Tag,
  type TagKind,
  TurningMark,
} from '../../components/StateTag.tsx';
export { TextAction } from '../../components/TextAction.tsx';

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
  line?: string | undefined;
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
  line,
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
    { minHeight: line == null ? 52 : 64, paddingVertical: pad, paddingHorizontal: gutter },
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
  head: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headTitle: { flex: 1, minWidth: 0, letterSpacing: -0.18, lineHeight: 18 * 1.25 },
  foot: { paddingTop: tokens.spaceXs },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  // Lit like People's row, with no ring: the owner found the ring weird (6 Nov 2026).
  rowSelected: { borderRadius: tokens.radiusRow, backgroundColor: tokens.colorAccentTint },
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
