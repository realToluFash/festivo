import { router } from 'expo-router';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import type { ViewInstance } from 'react-native';

import { useUnread } from '../notificationsUnread.ts';
import { RoundButton } from './SettingsParts.tsx';

/** The bell as the demos draw it: round and grey, a dot while anything is unread, and the exact count in its name. */
export function Bell({
  unread,
  onPress,
  testID,
  ref,
}: {
  unread: number;
  onPress: () => void;
  testID?: string | undefined;
  ref?: Ref<ViewInstance> | undefined;
}) {
  const { t } = useTranslation();

  return (
    <RoundButton
      ref={ref}
      glyph="bell"
      label={
        unread > 0 ? t('notifications.bellUnread', { count: unread }) : t('notifications.bell')
      }
      dot={unread > 0}
      onPress={onPress}
      testID={testID}
    />
  );
}

/** The bell in the frame (sc-3980), opening Notifications. */
export function BellButton() {
  const unread = useUnread();

  return <Bell unread={unread} onPress={() => router.push('/notifications')} testID="frame.bell" />;
}
