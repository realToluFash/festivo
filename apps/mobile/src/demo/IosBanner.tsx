import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../components/Text.tsx';
import { tokens } from '../theme/tokens.ts';

/** iOS names the app only on a push with no title, and every Soirely push has one. The body shows `lines` lines until a long press opens it; `startOpen` draws it already pressed and held. */
export function IosBanner({
  title,
  age,
  body,
  lines = 2,
  startOpen = false,
  raised = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  testID,
}: {
  title: string;
  age: string;
  body: string;
  lines?: number;
  startOpen?: boolean;
  raised?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button';
  testID?: string;
}) {
  const [open, setOpen] = useState(startOpen);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={() => setOpen((was) => !was)}
      style={({ pressed }) => [styles.banner, raised && styles.raised, pressed && styles.pressed]}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      <View style={styles.mark}>
        <Text size={18} weight="bold" accessible={false} style={styles.onDark}>
          S
        </Text>
      </View>
      <View style={styles.words}>
        <View style={styles.head}>
          <Text
            size={15}
            weight="semibold"
            accessible={false}
            numberOfLines={1}
            style={styles.grow}
          >
            {title}
          </Text>
          <Text size={13} accessible={false} style={styles.secondary}>
            {age}
          </Text>
        </View>
        <Text
          size={15}
          accessible={false}
          numberOfLines={open ? undefined : lines}
          style={styles.num}
        >
          {body}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  raised: {
    ...tokens.elevationNative.dialog.ios,
    elevation: tokens.elevationNative.dialog.android.elevation,
  },
  pressed: { opacity: tokens.opacityPressed },
  mark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: tokens.colorAccentHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onDark: { color: tokens.colorInkOnDark },
  words: { flex: 1, minWidth: 0, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.spaceSm },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  num: { fontVariant: ['tabular-nums'] },
});
