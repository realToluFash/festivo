import type { ReactNode, Ref } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { ShapeMark, type MarkKind } from '../../components/StatusMark.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Disc } from '../team/TeamParts.tsx';

export function Chip({
  label,
  on,
  onPress,
  ref,
  testID,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  ref?: Ref<ViewInstance> | undefined;
  testID: string;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
      testID={testID}
    >
      {on && <Glyph name="tick" size={15} ink={tokens.colorAccentText} weight={2.6} />}
      <Text size={15} weight={on ? 'semibold' : 'medium'}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CloseX({ onPress, testID }: { onPress: () => void; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={4}
      style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      testID={testID}
    >
      <Glyph name="x" size={20} ink={tokens.colorInk} />
    </Pressable>
  );
}

export function MarkLine({
  kind,
  ink,
  words,
  dashed = false,
}: {
  kind: MarkKind;
  ink: string;
  words: string;
  dashed?: boolean;
}) {
  return (
    <View style={styles.mark}>
      {dashed ? (
        <View style={styles.dashed} accessibilityElementsHidden importantForAccessibility="no" />
      ) : (
        <ShapeMark kind={kind} side={14} ink={ink} />
      )}
      <Text size={14} weight="semibold" style={styles.grow}>
        {words}
      </Text>
    </View>
  );
}

export function PersonRow({
  name,
  lines,
  mark,
  actions,
  phone,
  first,
  amber = false,
  testID,
}: {
  name: string;
  lines: readonly string[];
  mark: ReactNode;
  actions?: ReactNode;
  phone: boolean;
  first: boolean;
  amber?: boolean;
  testID: string;
}) {
  return (
    <View
      style={[styles.row, !first && styles.rowSep, phone && styles.rowPhone, amber && styles.amber]}
      testID={testID}
    >
      <View style={styles.who}>
        <Disc name={name} />
        <View style={styles.grow}>
          <Text size={16} weight="semibold">
            {name}
          </Text>
          {lines.map((line) => (
            <Text key={line} size={14} style={styles.secondary}>
              {line}
            </Text>
          ))}
          {mark}
        </View>
      </View>
      {actions != null && (
        <View style={[styles.actions, phone && styles.actionsPhone]}>{actions}</View>
      )}
    </View>
  );
}

export function StationTile({ station, people }: { station: string; people: readonly string[] }) {
  const nobody = people.length === 0;

  return (
    <View style={[styles.tile, nobody && styles.tileEmpty]} testID={`wh.station.${station}`}>
      <Text size={15} weight="semibold">
        {station}
      </Text>
      {nobody ? (
        <MarkLine kind="notyet" ink={tokens.colorAttention} words={`Nobody on ${station}`} dashed />
      ) : (
        <Text size={14} style={styles.secondary}>
          {people.join(', ')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: 2 },
  secondary: { color: tokens.colorInkSecondary },
  pressed: { opacity: 0.7 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  chipOn: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  close: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusPill,
  },
  mark: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs, marginTop: 2 },
  dashed: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colorAttention,
  },
  row: {
    flexDirection: 'row',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceMd,
    alignItems: 'flex-start',
  },
  rowSep: { borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  rowPhone: { flexDirection: 'column', alignItems: 'stretch' },
  amber: {
    borderLeftWidth: 3,
    borderLeftColor: tokens.colorAttention,
    paddingLeft: tokens.spaceSm,
  },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', gap: tokens.spaceMd },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.spaceXs,
    maxWidth: 360,
  },
  actionsPhone: { justifyContent: 'flex-start', maxWidth: undefined },
  tile: {
    gap: 2,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorInset,
  },
  tileEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colorAttention,
    backgroundColor: tokens.colorCard,
  },
});
