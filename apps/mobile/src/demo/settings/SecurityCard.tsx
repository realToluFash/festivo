import type { Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { useReadOut } from '../../components/ReadOut.tsx';
import { type TextHandle, Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import type { SecurityLine } from './SecurityModel.ts';
import { CardGlyph, OnCard, StatusMark, type StepProps, SummaryCard } from './Summary.tsx';

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

  useReadOut(line?.kind === 'done' ? line.text : null, { quietAtMount: true });

  return (
    <SummaryCard size={wide ? 'wide' : 'page'} height={200} step={step} testID="security.card">
      <View style={styles.face}>
        <CardGlyph name="shield" side={face} />
        <View style={styles.words}>
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
      {line?.kind === 'todo' && <OnCard text={line.text} strong />}
      {line?.kind === 'done' && (
        <View style={styles.done} testID="security.said">
          <View style={styles.mark}>
            <StatusMark kind="yes" side={16} ink={tokens.colorInkOnDark} />
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
  words: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
  white: { color: tokens.colorInkOnDark },
  done: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  mark: { marginTop: tokens.spaceHair },
  grow: { flex: 1, minWidth: 0 },
});
