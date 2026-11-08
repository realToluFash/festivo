import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { WORDS } from './SecurityModel.ts';
import { Line, TextAction } from '../../components/Summary.tsx';

/** Check your email after a reset: what was sent, what to do if nothing came, and Send it again for the field. */
export function SentBody({ onAgain }: { onAgain: () => void }) {
  return (
    <>
      <Line text={WORDS.sentLead} />
      <View style={styles.nothing}>
        <Text size={16} weight="semibold" accessibilityRole="header">
          {WORDS.nothingThere}
        </Text>
        <Line size={14} text={WORDS.nothingThereLine} />
      </View>
      <View style={styles.start}>
        <TextAction label={WORDS.sendAgain} onPress={onAgain} testID="security.reset.again" />
      </View>
      <Line size={14} text={WORDS.signedUpWith} />
      <Line size={14} text={WORDS.gotTheLink} />
    </>
  );
}

const styles = StyleSheet.create({
  nothing: { gap: tokens.spaceXxs, paddingTop: tokens.spaceXs },
  start: { alignItems: 'flex-start' },
});
