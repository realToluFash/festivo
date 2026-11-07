import type { Ref } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { Text } from './Text.tsx';

/** B's action: Violet text, or red for anything that removes, with what it does on the line under it; `plain` is Ink, as Manage's Duplicate and Pause. */
export function TextAction({
  label,
  onPress,
  removes = false,
  plain = false,
  off = false,
  figures = false,
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
  plain?: boolean;
  off?: boolean;
  figures?: boolean;
  glyph?: GlyphName;
  after?: GlyphName;
  consequence?: string;
  accessibilityLabel?: string;
  testID?: string | undefined;
  ref?: Ref<ViewInstance>;
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

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  pressed: { opacity: tokens.opacityPressed },
  consequence: { lineHeight: 14 * 1.45 },
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
