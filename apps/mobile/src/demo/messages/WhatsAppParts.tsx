import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { WhereMark } from './MessageMarks.tsx';

/** A paid channel's reach line (sc-3950, sc-3946), under the channel chips and in the check whenever it is ticked. */
export function ChannelReach({ channel, line }: { channel: 'sms' | 'wa'; line: string }) {
  return (
    <View
      style={styles.reach}
      testID={channel === 'wa' ? 'messages.whatsAppReach' : 'messages.smsReach'}
    >
      <View style={styles.markAt}>
        <WhereMark where={channel} ink={tokens.colorInkSecondary} size={MARK} />
      </View>
      <Text size={13.5} weight="medium" style={[styles.secondary, styles.words]}>
        {line}
      </Text>
    </View>
  );
}

export function InsteadLine({ line }: { line: string }) {
  return (
    <Text
      size={13.5}
      weight="medium"
      style={[styles.secondary, styles.instead]}
      testID="messages.instead"
    >
      {line}
    </Text>
  );
}

const MARK = 15;

const styles = StyleSheet.create({
  reach: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  markAt: { paddingTop: 2 },
  secondary: { color: tokens.colorInkSecondary },
  words: { flex: 1, lineHeight: 13.5 * 1.4 },
  instead: { paddingLeft: MARK + tokens.spaceXs, lineHeight: 13.5 * 1.45 },
});
