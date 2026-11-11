import { StyleSheet, View } from 'react-native';

import { type WeightName } from '../theme/fonts.ts';
import { Text } from './Text.tsx';

export interface MeasuredText {
  key: string;
  text: string;
  size: number;
  weight: WeightName;
}

/** Each text drawn unseen on one line at its own size, its width handed back under its key. */
export function MeasureTexts({
  texts,
  onWidth,
}: {
  texts: readonly MeasuredText[];
  onWidth: (key: string, width: number) => void;
}) {
  return (
    <View
      style={styles.measure}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {texts.map(({ key, text, size, weight }) => (
        <Text
          key={key}
          size={size}
          weight={weight}
          allowFontScaling={false}
          accessible={false}
          onLayout={(event) => onWidth(key, event.nativeEvent.layout.width)}
        >
          {text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 10000,
    alignItems: 'flex-start',
    opacity: 0,
  },
});
