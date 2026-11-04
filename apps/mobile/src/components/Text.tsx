import { createContext, type Ref, useContext, useSyncExternalStore } from 'react';
import {
  Text as RNText,
  StyleSheet,
  type TextInstance,
  type TextProps as RNTextProps,
  useWindowDimensions,
} from 'react-native';

import { type Family, WEIGHTS, faced, type WeightName } from '../theme/fonts.ts';
import { capUnderTitle } from '../layout/textSize.ts';
import { tokens } from '../theme/tokens.ts';
import { subscribeTextLaidOut, textLayoutsAtNewScale } from './textLaidOut.ts';

/**
 * Text with a weight, and without the two shapes that crash on web.
 *
 * It takes `weight` and resolves it to `fontWeight`, and `faced()` turns the
 * weight into a face, so no screen ever writes a `fontFamily` — see
 * src/theme/fonts.ts. Every word is Instrument Sans;
 * `family="googleSans"` is for the words on Google's sign-in button alone.
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
  family?: Family;
  ref?: Ref<TextHandle> | undefined;
}

export type TextHandle = TextInstance;

/** The size a screen's title is drawn at: no text inside grows past it (sc-28812). */
export const TitleCap = createContext<number | null>(null);

export function Text({
  weight = 'regular',
  size = 16,
  muted = false,
  family = 'sans',
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const { fontScale } = useWindowDimensions();
  const cap = useContext(TitleCap);
  const laidOut = useSyncExternalStore(subscribeTextLaidOut, textLayoutsAtNewScale);

  return (
    <RNText
      // Native measures text again when the text size changes, but lays out nothing around it: a new text is laid out from the root down.
      // JavaScript's next commit puts back the texts it last laid out, so on Android a text made before the root has the new scale keeps the old size; it is made again once the root has it.
      key={`${fontScale}:${laidOut}`}
      style={faced(
        [
          styles.base,
          { fontWeight: WEIGHTS[weight], fontSize: size },
          muted && styles.muted,
          style,
        ],
        family,
      )}
      maxFontSizeMultiplier={
        cap == null ? maxFontSizeMultiplier : capUnderTitle(cap, size, maxFontSizeMultiplier)
      }
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  // Yoga leaves a child at its full width unless told to shrink, so a text beside another in a row would run off the screen rather than wrap.
  base: { flexShrink: 1, color: tokens.colorInk },
  muted: { color: tokens.colorInkSecondary },
});
