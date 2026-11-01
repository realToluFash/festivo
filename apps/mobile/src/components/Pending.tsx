import { ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { ReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';

/** A read still on its way, said in words beside the spinner so it never reads as a blank, broken screen. */
export function Pending() {
  const { t } = useTranslation();
  const loading = t('pending.loading');

  return (
    <ReadOut words={loading} style={styles.pending} testID="pending">
      <ActivityIndicator
        color={tokens.colorAccent}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text muted>{loading}</Text>
    </ReadOut>
  );
}

const styles = StyleSheet.create({
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
    paddingVertical: tokens.space5xl,
  },
});
