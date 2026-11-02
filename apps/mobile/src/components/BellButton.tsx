import { badgeOf } from '@soirely/domain';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useUnread } from '../notificationsUnread.ts';
import { tokens } from '../theme/tokens.ts';
import { BellMark } from './BellMark.tsx';
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
      <BellMark ink={tokens.colorInk} />
      {badge != null && (
        <View style={styles.badge} importantForAccessibility="no-hide-descendants">
          <Text
            size={tokens.typePill.size}
            weight="semibold"
            numberOfLines={1}
            maxFontSizeMultiplier={BADGE_TEXT_SCALE}
            style={styles.badgeInk}
          >
            {badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const BADGE_SIDE = 18;
const BADGE_TEXT_SCALE = 1.25;

const styles = StyleSheet.create({
  bell: {
    minWidth: tokens.sizeHit,
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: tokens.spaceXxs,
    right: tokens.spaceXxs,
    minWidth: BADGE_SIDE,
    minHeight: BADGE_SIDE,
    paddingHorizontal: tokens.spaceXxs,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInk: { color: tokens.colorInkOnDark },
});
