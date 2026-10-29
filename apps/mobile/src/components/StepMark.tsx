import { StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';
import { useMarkSide } from './markSide.ts';

export type StepState = 'done' | 'now' | 'later';

/** A numbered step's circle, grown with the system text size as its character is; hidden from the screen reader, which reads the step's words. */
export function StepMark({ step, state }: { step: number; state: StepState }) {
  const markSide = useMarkSide(tokens.space3xl);

  return (
    <View
      style={[styles.mark, markSide, FILL[state]]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text size={tokens.typePill.size} weight="bold" mono style={INK[state]} accessible={false}>
        {state === 'done' ? '✓' : step}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusPill,
  },
});

const FILL = StyleSheet.create({
  done: { backgroundColor: tokens.colorAccent },
  now: { backgroundColor: tokens.colorDark },
  later: {
    borderWidth: 1.5,
    borderColor: tokens.colorMarkEmpty,
    backgroundColor: tokens.colorCard,
  },
});

const INK = StyleSheet.create({
  done: { color: tokens.colorInkOnDark },
  now: { color: tokens.colorInkOnDark },
  later: { color: tokens.colorInkSecondary },
});
