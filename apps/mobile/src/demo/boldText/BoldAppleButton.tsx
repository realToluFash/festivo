import { Pressable, StyleSheet } from 'react-native';

import { CONTROL_TEXT_SIZE } from '../../components/Field.tsx';
import { useOneHeight } from '../../components/OneHeight.tsx';
import { AppleLogoIos, useAppleIosSize } from '../../components/ProviderSignIn.tsx';
import { Text } from '../../components/Text.tsx';
import { brand } from '../../theme/brand.ts';
import { tokens } from '../../theme/tokens.ts';
import { appleIosWeight } from './BoldTextModel.ts';

/** ProviderButton's iPhone Apple button with its words in system Bold: it takes no weight, so the developer gives it this one. */
export function BoldAppleButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const size = useAppleIosSize();
  const oneHeight = useOneHeight();

  return (
    <Pressable
      key={oneHeight.key}
      style={[styles.button, { gap: size.gap }, oneHeight.style]}
      onLayout={oneHeight.onLayout}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      testID={testID}
    >
      <AppleLogoIos logoHeight={size.logoHeight} />
      <Text
        size={CONTROL_TEXT_SIZE}
        weight={appleIosWeight(true)}
        family="system"
        style={styles.words}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXxl,
    paddingVertical: tokens.spaceSm,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    backgroundColor: brand.appleSurface,
    borderColor: brand.appleBorder,
  },
  words: { color: brand.appleInk },
});
