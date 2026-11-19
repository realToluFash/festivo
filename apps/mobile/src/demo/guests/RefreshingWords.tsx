import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '../../components/Text.tsx';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';

const MARK = 16;
const TURN_MS = 800;

/** The product's Refreshing… (components/Refreshing.tsx) with its words handed in, so the demo can speak Portuguese: the turning mark beside the first word, the words whole, wrapping only between them where a line is too narrow (sc-71821). The build folds `words`, the wrap and the first-line mark into components/Refreshing.tsx; the product keeps one Refreshing. */
export function RefreshingWords({ words, testID }: { words: string; testID: string }) {
  const reduced = useReducedMotion();
  const [turn] = useState(() => new Animated.Value(0));
  const [firstLine, setFirstLine] = useState(0);

  useEffect(() => {
    turn.setValue(0);
    if (reduced) return;
    const run = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: TURN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    run.start();

    return () => run.stop();
  }, [reduced, turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.row} testID={testID}>
      <View style={[styles.markLine, firstLine > 0 && { height: firstLine }]}>
        <Animated.View
          style={{ transform: [{ rotate }] }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID={`${testID}.mark`}
        >
          <Svg width={MARK} height={MARK} viewBox="0 0 16 16" fill="none">
            <Circle
              cx={8}
              cy={8}
              r={6}
              stroke={tokens.colorInkSecondary}
              strokeOpacity={0.3}
              strokeWidth={2}
            />
            <Path
              d="M8 2a6 6 0 0 1 6 6"
              stroke={tokens.colorInkSecondary}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
      </View>
      <Text
        size={tokens.typeBody.size}
        muted
        accessibilityRole="text"
        onTextLayout={(event) => setFirstLine(Math.ceil(event.nativeEvent.lines[0]?.height ?? 0))}
      >
        {words}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm, flexShrink: 1 },
  markLine: { justifyContent: 'center' },
});
