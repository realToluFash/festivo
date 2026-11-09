import type { Ref } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { Initials } from '../../components/Initials.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../queue/QueueParts.tsx';
import type { Mode } from './TeamModel.ts';

export const OFFLINE_GLYPH = [
  'M2 2l20 20',
  'M8.5 16.5a5 5 0 0 1 7 0',
  'M5 13a10 10 0 0 1 5.24-2.76',
  'M12 20h.01',
];

export function Disc({ name, you = false }: { name: string; you?: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.disc, you && styles.discYou]}
    >
      <Initials name={name} size={13} weight="bold" style={you ? styles.onDark : styles.ink} />
    </View>
  );
}

/** Offline it stays in its place, dashed, and a press says why it does nothing. */
export function MoveButton({
  place,
  offline,
  side,
  onPress,
  ref,
  testID,
}: {
  place: string;
  offline: boolean;
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
      accessibilityLabel={`Move someone to ${place}`}
      accessibilityState={{ disabled: offline }}
      style={({ pressed }) => [
        styles.move,
        { minHeight: side },
        offline && styles.moveOff,
        pressed && !offline && styles.pressed,
      ]}
      testID={testID}
    >
      <Glyph
        paths={['M5 12h14', 'm12 5 7 7-7 7']}
        ink={offline ? tokens.colorInkSecondary : tokens.colorAccentText}
        side={16}
      />
      <Text
        size={15}
        weight="semibold"
        style={offline ? styles.secondary : styles.accent}
        numberOfLines={2}
      >
        Move someone here
      </Text>
    </Pressable>
  );
}

const MODE_WORD: Record<Mode, string> = { well: 'As well', instead: 'Instead' };

export function ModeChoice({
  modes,
  mode,
  side,
  onPick,
}: {
  modes: readonly Mode[];
  mode: Mode;
  side: number;
  onPick: (mode: Mode) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="radiogroup">
      {modes.map((m) => {
        const on = m === mode;
        return (
          <Pressable
            key={m}
            onPress={() => onPick(m)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.segment, { minHeight: side - 4 }, on && styles.segmentOn]}
            testID={`team.mode.${m}`}
          >
            <Text
              size={15}
              weight={on ? 'semibold' : 'medium'}
              style={on ? styles.accent : styles.secondary}
            >
              {MODE_WORD[m]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function WarnLine({ words }: { words: string }) {
  return (
    <View style={styles.warn}>
      <Glyph
        paths={[
          'M12 9v4',
          'M12 17h.01',
          'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
        ]}
        ink={tokens.colorAttentionText}
        side={14}
      />
      <Text size={14} weight="semibold" style={styles.warnText}>
        {words}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colorAccentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discYou: { backgroundColor: tokens.colorInk },
  onDark: { color: tokens.colorInkOnDark },
  ink: { color: tokens.colorAccentText },
  move: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  moveOff: {
    borderStyle: 'dashed',
    borderColor: tokens.colorInkTertiary,
    backgroundColor: tokens.colorInset,
  },
  pressed: { opacity: tokens.opacityPressed },
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  track: {
    flexDirection: 'row',
    padding: 2,
    gap: 2,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusPill,
  },
  segmentOn: { backgroundColor: tokens.colorCard },
  warn: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  warnText: { color: tokens.colorAttentionText, flexShrink: 1 },
});
