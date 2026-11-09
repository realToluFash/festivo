import type { Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { useReadOut } from './ReadOut.tsx';
import { type TextHandle, Text } from './Text.tsx';
import { tokens } from '../theme/tokens.ts';
import { useCardWords } from './Cover.tsx';
import type { SecurityLine } from '../kit/securityPage.ts';
import { CardGlyph, OnCard, ShapeMark, type StepProps, SummaryCard } from './Summary.tsx';

/** How you are protected on Confetti: the shield, two-factor on or off and what signs you in, then what just happened or why it matters. */
export function SecurityCard({
  says,
  counts,
  line,
  wide,
  step,
  saysRef,
}: {
  says: string;
  counts: string;
  line: SecurityLine;
  wide: boolean;
  step: StepProps | null;
  saysRef: Ref<TextHandle>;
}) {
  const face = wide ? 64 : 56;
  const size = wide ? 24 : 22;
  const words = useCardWords(line?.text ?? null);

  useReadOut(line?.kind === 'done' ? line.text : null, { quietAtMount: true });

  return (
    <SummaryCard
      size={wide ? 'wide' : 'page'}
      height={200}
      step={step}
      words={words.boxes}
      testID="security.card"
    >
      <View style={styles.face} onLayout={words.onArea}>
        <CardGlyph name="shield" side={face} />
        <View style={styles.words} onLayout={words.onWords}>
          <Text
            ref={saysRef}
            size={size}
            weight="bold"
            accessibilityRole="header"
            style={[
              styles.white,
              { lineHeight: Math.round(size * 1.15), letterSpacing: size * -0.015 },
            ]}
            testID="security.says"
          >
            {says}
          </Text>
          <OnCard text={counts} />
        </View>
      </View>
      {line?.kind === 'todo' && (
        <View style={styles.line} onLayout={words.onLine}>
          <OnCard text={line.text} strong />
        </View>
      )}
      {line?.kind === 'done' && (
        <View style={styles.done} onLayout={words.onLine} testID="security.said">
          <View style={styles.mark}>
            <ShapeMark kind="yes" side={16} ink={tokens.colorInkOnDark} />
          </View>
          <View style={styles.grow}>
            <OnCard text={line.text} strong />
          </View>
        </View>
      )}
    </SummaryCard>
  );
}

const styles = StyleSheet.create({
  face: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  words: { flexShrink: 1, minWidth: 0, gap: tokens.spaceHair },
  white: { color: tokens.colorInkOnDark },
  line: { alignSelf: 'flex-start' },
  done: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    gap: tokens.spaceSm,
  },
  mark: { marginTop: tokens.spaceHair },
  grow: { flexShrink: 1, minWidth: 0 },
});
