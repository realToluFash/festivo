import type { Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { type Refusal, SW, refusalLine } from './ScheduledSave.ts';

/** sc-3963: a scheduled message's refused save, where the Editing line was: a red edge and the alert mark with the words, never colour alone. */
export function RefusedSave({
  refusal,
  alertRef,
  onReload,
}: {
  refusal: Refusal;
  alertRef: Ref<ViewInstance>;
  onReload: () => void;
}) {
  const first = refusalLine(refusal);

  return (
    <View style={styles.refused} testID="messages.refusedSave">
      <View
        ref={alertRef}
        style={styles.said}
        accessible
        accessibilityRole="alert"
        accessibilityLabel={`${first} ${SW.textStillHere}`}
      >
        <View style={styles.markTop}>
          <Glyph name="alert" size={18} ink={tokens.colorBroken} weight={2.2} />
        </View>
        <View style={styles.words}>
          <Text size={14.5} weight="bold" accessible={false} style={styles.line}>
            {first}
          </Text>
          <Text size={14} weight="medium" accessible={false} style={styles.line}>
            {SW.textStillHere}
          </Text>
        </View>
      </View>
      <View style={styles.reload}>
        <TextAction
          label={SW.reload}
          glyph="refresh"
          onPress={onReload}
          testID="messages.refusedSave.reload"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  refused: {
    alignSelf: 'flex-end',
    width: '100%',
    maxWidth: 520,
    paddingTop: 14,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.spaceXxs,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: tokens.colorBroken,
    backgroundColor: tokens.colorCard,
  },
  said: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  markTop: { paddingTop: 1 },
  words: { flex: 1, minWidth: 0, gap: tokens.spaceXxs },
  line: { lineHeight: 14.5 * 1.4 },
  reload: { paddingLeft: 26 },
});
