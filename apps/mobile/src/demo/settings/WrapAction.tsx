import type { Ref } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';

/** sc-40153: Remove's text action with its label wrapped whole, the organisation's name never cut; one that fits looks as today. */
export function WrapRemoveAction({
  label,
  consequence,
  onPress,
  testID,
  ref,
}: {
  label: string;
  consequence: string;
  onPress: () => void;
  testID?: string;
  ref?: Ref<ViewInstance>;
}) {
  return (
    <View>
      <Pressable
        ref={ref}
        onPress={onPress}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
      >
        <Text size={15} weight="semibold" accessible={false} style={styles.label}>
          {label}
        </Text>
      </Pressable>
      <Text size={14} weight="medium" style={styles.consequence}>
        {consequence}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    minHeight: tokens.sizeHit,
    minWidth: tokens.sizeHit,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 11,
  },
  pressed: { opacity: tokens.opacityPressed },
  label: { color: tokens.colorBroken, lineHeight: 22 },
  consequence: { color: tokens.colorInkSecondary, lineHeight: 14 * 1.45 },
});
