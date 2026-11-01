import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

/** A figure the product has no data for yet: its label, then Coming soon in its place, never a number, and nothing to press (sc-22103). */
export function Placeholder({
  label,
  labelSize = tokens.typeSmall.size,
  testID,
}: {
  label: string;
  labelSize?: number;
  testID?: string;
}) {
  const { t } = useTranslation();
  const soon = t('eventsScreen.comingSoon');

  return (
    <View
      style={styles.placeholder}
      accessible
      accessibilityLabel={`${label}, ${soon}`}
      testID={testID}
    >
      <Text size={labelSize} muted>
        {label}
      </Text>
      <Text size={tokens.typeSmall.size} weight="semibold" muted>
        {soon}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { gap: tokens.spaceHair },
});
