import { StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Initials } from './Initials.tsx';

/** An organisation's initials on its tile; the web draws the same tile with `.org-tile`. */
export function OrgTile({
  name,
  size = 'row',
  invited = false,
}: {
  name: string;
  size?: 'row' | 'card';
  invited?: boolean;
}) {
  const card = size === 'card';
  return (
    <View
      style={[styles.tile, card ? styles.card : styles.row, invited && styles.invited]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Initials
        name={name}
        size={card ? tokens.typeButton.size : tokens.typeMeta.size}
        weight={card ? 'semibold' : 'bold'}
        muted={invited}
        style={invited ? undefined : styles.initials}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentTint,
  },
  row: {
    width: tokens.space5xl,
    height: tokens.space5xl,
    borderRadius: tokens.radiusSmall,
  },
  card: {
    width: tokens.space6xl,
    height: tokens.space6xl,
    borderRadius: tokens.radiusNav,
  },
  invited: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkTertiary,
    backgroundColor: tokens.colorCard,
  },
  initials: { color: tokens.colorAccentText },
});
