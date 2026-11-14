import { StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

/** The host's arrival note under the venue, with its line breaks, as plain text (sc-24385). */
export function ArrivalNoteInset({ note }: { note: string }) {
  return (
    <View style={styles.inset} testID="events.arrivalNote">
      <Text size={14} style={styles.words}>
        {note}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inset: {
    alignSelf: 'stretch',
    marginBottom: tokens.spaceSm,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  words: { lineHeight: 14 * 1.5 },
});
