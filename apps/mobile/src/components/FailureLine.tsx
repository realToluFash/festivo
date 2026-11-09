import { StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { ReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';

/** What did not go, beside the alert mark and read out as an alert; what was typed and chosen stays, and the verb turns back on. */
export function FailureLine({ words, testID }: { words: string; testID?: string }) {
  return (
    <ReadOut
      words={words}
      interrupts
      accessibilityRole="alert"
      style={styles.line}
      testID={testID}
    >
      <View style={styles.mark}>
        <Glyph name="alert" size={18} ink={tokens.colorInkSecondary} weight={2.2} />
      </View>
      <Text size={15} weight="medium" style={styles.words}>
        {words}
      </Text>
    </ReadOut>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  mark: { marginTop: tokens.spaceHair },
  words: { flex: 1, minWidth: 0, lineHeight: 15 * 1.45 },
});
