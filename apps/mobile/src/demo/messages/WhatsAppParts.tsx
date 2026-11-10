import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { DeliveryMark, WhereMark } from './MessageMarks.tsx';
import { say } from './MessagesWords.ts';

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

/** A held message's WhatsApp waiting for credits, in Messaging B's wait look, under its receipt. */
export function HeldWaits({ count }: { count: number }) {
  return (
    <View style={styles.waits} testID="messages.held.waits">
      <View style={styles.markAt}>
        <DeliveryMark mark="sending" side={15} />
      </View>
      <Text size={14} weight="semibold" style={styles.held}>
        {say.waitingForCredits(count)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  reach: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  markAt: { paddingTop: 2 },
  secondary: { color: tokens.colorInkSecondary },
  words: { flex: 1, lineHeight: 13.5 * 1.4 },
  held: { flex: 1, lineHeight: 14 * 1.4 },
  waits: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceXs,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
});
