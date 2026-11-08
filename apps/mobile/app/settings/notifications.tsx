import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, besideRow } from '../../src/components/AppFrame.tsx';
import { Refreshing } from '../../src/components/Refreshing.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { NotificationSettingsGrid } from '../../src/components/NotificationSettingsGrid.tsx';
import { Screen } from '../../src/components/Screen.tsx';
import { SettingsSplit, useBackToSettings } from '../../src/components/SettingsList.tsx';
import { Text, type TextHandle } from '../../src/components/Text.tsx';
import { moveScreenReaderFocus } from '../../src/components/screenReaderFocus.ts';
import { useOffline } from '../../src/offline.ts';
import { type LayoutKind, settingsListBeside, useLayout } from '../../src/layout/useLayout.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** Settings > Notifications in the app (sc-3980), under Your account. */
export default function Notifications() {
  const { t } = useTranslation();
  const backToSettings = useBackToSettings();
  const { kind } = useLayout();
  const alone = !settingsListBeside(kind);
  const title = useRef<TextHandle>(null);
  const [loaded, setLoaded] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const { watch, stale, refreshing } = useOffline({
    loaded,
    reload: () => setRefresh((n) => n + 1),
    focusTitle: () => moveScreenReaderFocus(title.current),
  });

  const refreshingWords = refreshing ? (
    <Refreshing testID="notificationSettings.refreshing" />
  ) : null;

  return (
    <AppFrame
      current="settings"
      aboutTheAccount
      offline={stale}
      besideTitle={alone ? refreshingWords : undefined}
      titleRef={alone ? title : undefined}
      title={alone ? t('notificationSettings.title') : t('settings.title')}
      back={alone ? backToSettings(t('settings.title')) : undefined}
    >
      <SettingsSplit open="notifications">
        <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
          {!alone && (
            <View style={besideRow.row}>
              <View style={styles.shrink}>
                <Text
                  ref={title}
                  size={tokens.typeTitlePage.size}
                  weight="bold"
                  accessibilityRole="header"
                >
                  {t('notificationSettings.title')}
                </Text>
              </View>
              {refreshingWords}
            </View>
          )}
          <NotificationSettingsGrid
            kind={kind}
            watch={watch}
            refresh={refresh}
            onLoaded={setLoaded}
          />
        </Screen>
      </SettingsSplit>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1, minWidth: 0 },
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
