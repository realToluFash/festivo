import type { Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { useReadOut } from '../../components/ReadOut.tsx';
import { ShapeMark } from '../../components/Summary.tsx';
import { type TextHandle, Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';

const SIZE = 14.5;

/** The card's done line on the page ground, in the card's place while two-factor has not loaded: ink, no ground, no rule. */
export function AloneLine({ text, lineRef }: { text: string; lineRef: Ref<TextHandle> }) {
  useReadOut(text, { quietAtMount: true });

  return (
    <View style={styles.line} testID="security.said.alone">
      <View style={styles.mark}>
        <ShapeMark kind="yes" side={16} ink={tokens.marks.done.ink} />
      </View>
      <Text ref={lineRef} size={SIZE} weight="semibold" style={styles.words}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  mark: { marginTop: tokens.spaceHair },
  words: { flexShrink: 1, minWidth: 0, color: tokens.colorInk, lineHeight: SIZE * 1.4 },
});
