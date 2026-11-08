import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useUnread } from '../notificationsUnread.ts';
import { RoundButton } from './SettingsParts.tsx';

/** The bell in the frame (sc-3980), as the demos draw it: a dot while anything is unread, and the exact count in its name. */
export function BellButton() {
  const { t } = useTranslation();
  const unread = useUnread();

  return (
    <RoundButton
      glyph="bell"
      label={
        unread > 0 ? t('notifications.bellUnread', { count: unread }) : t('notifications.bell')
      }
      dot={unread > 0}
      onPress={() => router.push('/notifications')}
      testID="frame.bell"
    />
  );
}
