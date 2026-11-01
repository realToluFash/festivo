import { ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { ReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';
import { useShownAfter } from './useShownAfter.ts';

/** A read still on its way, said in words beside the spinner so it never reads as a blank, broken screen. */
export function Pending({ after = 0, stacked = false }: { after?: number; stacked?: boolean }) {
  const { t } = useTranslation();
  const waited = useShownAfter(after);
  const loading = t('pending.loading');

  if (after > 0 && !waited) return null;

  return (
    <ReadOut words={loading} style={stacked ? styles.stacked : styles.pending} testID="pending">
      <ActivityIndicator
        color={tokens.colorAccent}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text muted {...(stacked && { size: tokens.typeBodyPhone.size })}>
        {loading}
      </Text>
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
  stacked: {
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
});
