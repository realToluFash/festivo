import type { Ref } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import type { Control, Tag } from './QueueModel.ts';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

const CONTROL_PATHS: Record<Control, readonly string[]> = {
  front: ['M5 4h14', 'M12 20V9', 'm7 13 5-5 5 5'],
  up: ['m18 15-6-6-6 6'],
  down: ['m6 9 6 6 6-6'],
};

export const CONTROL_LABEL: Record<Control, (place: string) => string> = {
  front: (p) => `Bring ${p} forward`,
  up: (p) => `Move ${p} up`,
  down: (p) => `Move ${p} down`,
};

export function Glyph({
  paths,
  ink,
  side = 18,
  circle = false,
}: {
  paths: readonly string[];
  ink: string;
  side?: number;
  circle?: boolean;
}) {
  return (
    <View {...hidden}>
      <Svg
        width={side}
        height={side}
        viewBox="0 0 24 24"
        fill="none"
        stroke={ink}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {circle && <Circle cx={12} cy={12} r={9} />}
        {paths.map((d) => (
          <Path key={d} d={d} />
        ))}
      </Svg>
    </View>
  );
}

const TAG_PATHS: Record<Tag['kind'], readonly string[]> = {
  next: ['M5 12h14', 'm12 5 7 7-7 7'],
  tray: ['M4 16h16', 'M6 16a6 6 0 0 1 12 0'],
  served: ['M20 6 9 17l-5-5'],
  owed: ['M12 7v5l3 2'],
};

export function TagPill({ tag }: { tag: Tag }) {
  const accent = tag.kind === 'next' || tag.kind === 'tray';
  const ink = accent ? tokens.colorAccentText : tokens.colorInk;

  return (
    <View style={[styles.tag, accent ? styles.tagAccent : styles.tagPlain]}>
      <Glyph paths={TAG_PATHS[tag.kind]} ink={ink} side={13} circle={tag.kind === 'owed'} />
      <Text size={13} weight="semibold" style={{ color: ink }} numberOfLines={1}>
        {tag.label}
      </Text>
    </View>
  );
}

export function ControlButton({
  control,
  place,
  side,
  onPress,
  ref,
  testID,
}: {
  control: Control;
  place: string;
  side: number;
  onPress: () => void;
  ref?: Ref<ViewInstance>;
  testID: string;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={CONTROL_LABEL[control](place)}
      style={({ pressed }) => [
        styles.control,
        { width: side, height: side, borderRadius: side / 2 },
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <Glyph paths={CONTROL_PATHS[control]} ink={tokens.colorInk} side={20} />
    </Pressable>
  );
}

export function ControlGap({ side }: { side: number }) {
  return <View style={{ width: side, height: side }} />;
}

export function PlaceNumber({ n, next }: { n: number; next: boolean }) {
  return (
    <View {...hidden} style={[styles.number, next ? styles.numberNext : styles.numberPlain]}>
      <Text size={16} weight="bold" accessible={false} style={next ? styles.onAccent : styles.ink}>
        {String(n)}
      </Text>
    </View>
  );
}

export function FlagLine({ flag }: { flag: string }) {
  return (
    <View style={styles.flag}>
      <Glyph
        paths={['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7']}
        ink={tokens.colorBrokenText}
        side={13}
      />
      <Text size={14} weight="semibold" style={styles.flagText}>
        {flag}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tagAccent: { backgroundColor: tokens.colorAccentTint },
  tagPlain: { backgroundColor: tokens.colorInset },
  control: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
  },
  pressed: { opacity: tokens.opacityPressed },
  number: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberNext: { backgroundColor: tokens.colorAccent },
  numberPlain: { backgroundColor: tokens.colorInset },
  onAccent: { color: tokens.colorInkOnDark },
  ink: { color: tokens.colorInk },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flagText: { color: tokens.colorBrokenText },
});
