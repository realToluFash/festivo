import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';

import { SettingsPage, useShell } from './Frame.tsx';
import { NotificationsGrid } from './NotificationsGrid.tsx';
import { NOTIFICATIONS_TITLE, notificationsStateOf } from './NotificationsModel.ts';

/** Notification settings, in B, on sample data: the board on page 29, working. */
export function NotificationsSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const { layout } = useShell();
  const shown = notificationsStateOf(state);

  return (
    <SettingsPage title={NOTIFICATIONS_TITLE}>
      <NotificationsGrid
        key={shown ?? 'atRest'}
        state={shown}
        phone={layout === 'phone'}
        locale={formattingLocale('en', getLocales()[0]?.languageTag)}
      />
    </SettingsPage>
  );
}
