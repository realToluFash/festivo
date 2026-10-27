import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame } from '../../src/components/AppFrame.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { NotificationSettingsGrid } from '../../src/components/NotificationSettingsGrid.tsx';
import { Screen } from '../../src/components/Screen.tsx';
import { SettingsSplit, backToSettings } from '../../src/components/SettingsList.tsx';
import { Text } from '../../src/components/Text.tsx';
import { type LayoutKind, useLayout } from '../../src/layout/useLayout.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** Settings > Notifications in the app (sc-3980), under Your account. */
export default function Notifications() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const phone = kind === 'phone';

  return (
    <AppFrame
      current="settings"
      aboutTheAccount
      title={phone ? t('notificationSettings.title') : t('settings.title')}
      back={phone ? backToSettings(t('settings.title')) : undefined}
    >
      <SettingsSplit open="notifications">
        <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
          {!phone && (
            <Text
              size={
                kind === 'tabletLandscape' ? tokens.typeTitlePage.size : tokens.typeTitlePhone.size
              }
              weight="bold"
              accessibilityRole="header"
            >
              {t('notificationSettings.title')}
            </Text>
          )}
          <NotificationSettingsGrid kind={kind} />
        </Screen>
      </SettingsSplit>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  phone: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  portrait: { gap: tokens.spaceXl, padding: tokens.space3xl, paddingBottom: tokens.space6xl },
  landscape: {
    gap: tokens.spaceXxl,
    paddingTop: tokens.space4xl,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space6xl,
  },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
