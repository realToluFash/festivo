import { badgeOf } from '@soirely/domain';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useUnread } from '../notificationsUnread.ts';
import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

/** The bell in the frame (sc-3980): its name gives the exact count, the badge stops at 99+. */
export function BellButton() {
  const { t } = useTranslation();
  const unread = useUnread();
  const badge = badgeOf(unread, t('notifications.overNinetyNine'));

  return (
    <Pressable
      style={styles.bell}
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0 ? t('notifications.bellUnread', { count: unread }) : t('notifications.bell')
      }
      testID="frame.bell"
    >
      <Svg
        width={tokens.sizeMark}
        height={tokens.sizeMark}
        viewBox="0 0 24 24"
        fill="none"
        stroke={tokens.colorInk}
        strokeWidth={1.75}
      >
        <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
        <Path d="M10 20.5a2 2 0 0 0 4 0" />
      </Svg>
      {badge != null && (
        <View style={styles.badge} importantForAccessibility="no-hide-descendants">
          <Text size={tokens.typeSmall.size} weight="semibold" style={styles.badgeInk}>
            {badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: {
    minWidth: tokens.sizeHit,
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxs,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorDark,
    alignItems: 'center',
  },
  badgeInk: { color: tokens.colorInkOnDark },
});
