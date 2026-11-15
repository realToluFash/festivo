import { type ReactNode, type Ref, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';

import { labelFits } from '../layout/titleFit.ts';
import { titleSize } from '../layout/textSize.ts';
import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { Pill } from './SettingsParts.tsx';
import { MeasuredWords } from './Title.tsx';

export interface TopPrimaryProps {
  label: string;
  onPress: () => void;
  testID: string;
}

/** The primary at the end of a top's title row, as the demos draw it: the round violet + on a phone, the + and its label wider (sc-39471). */
export function TopPrimary({
  label,
  onPress,
  wide,
  testID,
  ref,
}: TopPrimaryProps & { wide: boolean; ref?: Ref<ViewInstance> }) {
  if (wide)
    return (
      <Pill
        ref={ref}
        label={label}
        glyph="plus"
        height={tokens.sizeHit}
        full={false}
        onPress={onPress}
        testID={testID}
      />
    );

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Glyph name="plus" size={20} ink={tokens.colorInkOnDark} weight={2.6} />
    </Pressable>
  );
}

/** Whether a top's primary keeps its label beside the title: only where the title at its size and the labelled primary both fit on the row's one line, from the width the title is left (sc-51444). */
export function usePrimaryLabel({
  title,
  size,
  style,
  label,
  gap,
  labelled,
}: {
  title: string;
  size: number;
  style?: StyleProp<TextStyle>;
  label: string | undefined;
  gap: number;
  /** Whether the layout labels a primary at all; a phone's is always round. */
  labelled: boolean;
}): { wide: boolean; onSlot: (event: LayoutChangeEvent) => void; measure: ReactNode } {
  const { fontScale } = useWindowDimensions();
  // The title's slot as last laid out, and whether the primary beside it then was labelled.
  const [slot, setSlot] = useState({ width: 0, wide: true });
  const [titleWidth, setTitleWidth] = useState(0);
  const [labelledWidth, setLabelledWidth] = useState(0);
  const measuring = labelled && label != null;
  const wide =
    measuring &&
    labelFits({
      room: slot.width > 0 ? slot.width + gap + (slot.wide ? labelledWidth : tokens.sizeHit) : 0,
      title: titleWidth,
      extra: 0,
      labelled: labelledWidth,
      gap,
    });
  const widthOf = (set: (width: number) => void) => (event: LayoutChangeEvent) =>
    set(Math.ceil(event.nativeEvent.layout.width));

  return {
    wide,
    onSlot: (event) => {
      const width = Math.ceil(event.nativeEvent.layout.width);
      setSlot((current) =>
        current.width === width && current.wide === wide ? current : { width, wide },
      );
    },
    measure: measuring && (
      <>
        <MeasuredWords
          words={[title]}
          size={size}
          weight="bold"
          style={style}
          maxFontSizeMultiplier={titleSize(size, fontScale) / size}
          onWidth={(_, width) => setTitleWidth(Math.ceil(width))}
        />
        <View
          style={styles.measure}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View onLayout={widthOf(setLabelledWidth)}>
            <Pill label={label} glyph="plus" height={tokens.sizeHit} full={false} />
          </View>
        </View>
      </>
    ),
  };
}

const styles = StyleSheet.create({
  pressed: { opacity: tokens.opacityPressed },
  round: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccent,
  },
  // Unbounded, so the label is measured on one line whatever the slot it sits in.
  measure: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 10000,
    alignItems: 'flex-start',
    opacity: 0,
  },
});
