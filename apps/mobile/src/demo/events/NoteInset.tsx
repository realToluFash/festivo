import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';

/** The host's arrival note under the venue, with its line breaks, as plain text. */
export function NoteInset({ note }: { note: string }) {
  return (
    <View style={styles.inset} testID="event.arrivalNote">
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
