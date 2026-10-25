import { type Ref } from 'react';
import {
  Text as RNText,
  StyleSheet,
  type TextProps as RNTextProps,
  useWindowDimensions,
} from 'react-native';

import { WEIGHTS, faced, type WeightName } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';

/**
 * Text with a weight, and without the two shapes that crash on web.
 *
 * It takes `weight` and resolves it to `fontWeight`, and `faced()` turns the
 * weight into a face, so no screen ever writes a `fontFamily` — see
 * src/theme/fonts.ts. `mono` is for step numbers, keyboard shortcuts and codes
 * a person copies character by character, never for money or counts.
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
  mono?: boolean;
  ref?: Ref<TextHandle> | undefined;
}

export type TextHandle = RNText;

export function Text({
  weight = 'regular',
  size = 16,
  muted = false,
  mono = false,
  style,
  ...rest
}: TextProps) {
  const { fontScale } = useWindowDimensions();

  return (
    <RNText
      // Native measures text again when the text size changes, but lays out nothing around it: a new text is laid out from the root down.
      key={fontScale}
      style={faced(
        [
          styles.base,
          { fontWeight: WEIGHTS[weight], fontSize: size },
          muted && styles.muted,
          style,
        ],
        mono,
      )}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: tokens.colorInk },
  muted: { color: tokens.colorInkSecondary },
});
