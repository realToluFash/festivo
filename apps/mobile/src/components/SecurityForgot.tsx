import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { Line, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

/** Check your email after a reset: what was sent, what to do if nothing came, and Send it again for the field. */
export function SentBody({ onAgain }: { onAgain: () => void }) {
  const { t } = useTranslation();

  return (
    <>
      <Line text={t('security.sentLead')} />
      <View style={styles.nothing}>
        <Text size={16} weight="semibold" accessibilityRole="header">
          {t('security.nothingThere')}
        </Text>
        <Line size={14} text={t('security.nothingThereLine')} />
      </View>
      <View style={styles.start}>
        <TextAction
          label={t('recovery.sendAgain')}
          onPress={onAgain}
          testID="security.reset.again"
        />
      </View>
      <Line size={14} text={t('security.signedUpWith')} />
      <Line size={14} text={t('security.gotTheLink')} />
    </>
  );
}

const styles = StyleSheet.create({
  nothing: { gap: tokens.spaceXxs, paddingTop: tokens.spaceXs },
  start: { alignItems: 'flex-start' },
});
