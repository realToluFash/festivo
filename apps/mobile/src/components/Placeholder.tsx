import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { tracking } from '../theme/tracking.ts';
import { Text } from './Text.tsx';

/** A figure the product has no data for yet: its label, then Coming soon in its place, never a number, and nothing to press (sc-22103). */
export function Placeholder({
  label,
  look = 'stacked',
  labelSize = tokens.typeSmall.size,
  testID,
}: {
  label: string;
  look?: 'stacked' | 'tile' | 'figure';
  labelSize?: number;
  testID?: string;
}) {
  const { t } = useTranslation();
  const soon = t('eventsScreen.comingSoon');

  return (
    <View
      style={look === 'figure' ? styles.figure : look === 'tile' ? styles.tile : styles.stacked}
      accessible
      accessibilityLabel={`${label}, ${soon}`}
      testID={testID}
    >
      {look === 'tile' ? (
        <Text size={tokens.typeLabel.size} weight="semibold" muted style={styles.caps}>
          {label}
        </Text>
      ) : (
        <Text size={labelSize} weight={look === 'figure' ? 'semibold' : 'regular'} muted>
          {label}
        </Text>
      )}
      <Text
        size={tokens.typeBody.size}
        weight="medium"
        muted
        style={look === 'tile' && styles.soon}
      >
        {soon}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stacked: { gap: tokens.spaceHair },
  tile: { gap: tokens.spaceXs },
  figure: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: tokens.spaceXs,
  },
  caps: { textTransform: 'uppercase', letterSpacing: tracking(tokens.typeLabel) },
  soon: { minHeight: 28, textAlignVertical: 'center' },
});
