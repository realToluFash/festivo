import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { WhereMark } from './MessageMarks.tsx';

/** WhatsApp's reach line (sc-3950), under the channel chips and in the check whenever WhatsApp is ticked. */
export function WhatsAppReach({ line }: { line: string }) {
  return (
    <View style={styles.reach} testID="messages.whatsAppReach">
      <View style={styles.markAt}>
        <WhereMark where="wa" ink={tokens.colorInkSecondary} size={15} />
      </View>
      <Text size={13.5} weight="medium" style={[styles.secondary, styles.words]}>
        {line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  reach: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  markAt: { paddingTop: 2 },
  secondary: { color: tokens.colorInkSecondary },
  words: { flex: 1, lineHeight: 13.5 * 1.4 },
});
