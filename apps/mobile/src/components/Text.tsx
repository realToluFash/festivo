import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { WEIGHTS, type WeightName } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';

/**
 * Text with a weight, and without the two shapes that crash on web.
 *
 * It takes `weight` and resolves it to `fontWeight`, so no screen ever writes a
 * `fontFamily` — see src/theme/fonts.ts for why that matters once a custom
 * face is registered.
 *
 * It deliberately does NOT accept `onPress`. A Text with an onPress crashed the
 * previous build on React Native Web, so the replacement is a Pressable with a
 * Text inside it. Omitting the prop here makes the wrong thing a type error
 * instead of a runtime crash on one platform.
 */
export interface TextProps extends Omit<RNTextProps, 'onPress' | 'onLongPress'> {
  weight?: WeightName;
  size?: number;
  muted?: boolean;
}

export function Text({ weight = 'regular', size = 16, muted = false, style, ...rest }: TextProps) {
  return (
    <RNText
      style={[
        styles.base,
        { fontWeight: WEIGHTS[weight], fontSize: size },
        muted && styles.muted,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: tokens.colorInk },
  muted: { color: tokens.colorInkSecondary },
});
