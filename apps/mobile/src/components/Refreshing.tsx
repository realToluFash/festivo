import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

const MARK = 16;
const TURN_MS = 800;

/** A reload out on a screen that already shows what it loaded: the turning mark and "Refreshing…", the mark still when less motion is asked for (sc-27046). Where it `wraps`, as on Guests' own line, its words break only between them and the mark stays centred on the first line (sc-71821). */
export function Refreshing({
  testID,
  words,
  wraps = false,
}: {
  testID: string;
  /** Its words in a language other than the app's, as the demo's Portuguese states. */
  words?: string | undefined;
  wraps?: boolean;
}) {
  const { t } = useTranslation();
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

  const mark = (
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
  );

  return (
    <View style={wraps ? styles.wraps : styles.row} testID={testID}>
      {wraps ? (
        <View style={[styles.markLine, firstLine > 0 && { height: firstLine }]}>{mark}</View>
      ) : (
        mark
      )}
      <Text
        size={tokens.typeBody.size}
        muted
        accessibilityRole="text"
        onTextLayout={
          wraps
            ? (event) => setFirstLine(Math.ceil(event.nativeEvent.lines[0]?.height ?? 0))
            : undefined
        }
      >
        {words ?? t('eventsScreen.refreshing')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm, flexShrink: 0 },
  wraps: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm, flexShrink: 1 },
  markLine: { justifyContent: 'center' },
});
