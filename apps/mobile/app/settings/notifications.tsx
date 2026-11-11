import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, FrameTop, besideRow } from '../../src/components/AppFrame.tsx';
import { Refreshing } from '../../src/components/Refreshing.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { NotificationsPage } from '../../src/components/NotificationsPage.tsx';
import { Screen } from '../../src/components/Screen.tsx';
import { SettingsSplit, useBackToSettings } from '../../src/components/SettingsList.tsx';
import { Text, type TextHandle } from '../../src/components/Text.tsx';
import { moveScreenReaderFocus } from '../../src/components/screenReaderFocus.ts';
import { useOffline } from '../../src/offline.ts';
import { type LayoutKind, settingsListBeside, useLayout } from '../../src/layout/useLayout.ts';
import { tokens } from '../../src/theme/tokens.ts';
import { PANE_TITLE, paneTitle } from '../../src/components/topTitle.ts';

/** Settings > Notification settings in the app, summary first: the card, then the six kinds (sc-30411). */
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
      top="scrolls"
      aboutTheAccount
      offline={stale}
      besideTitle={alone ? refreshingWords : undefined}
      titleRef={alone ? title : undefined}
      title={alone ? t('notificationSettings.title') : t('settings.title')}
      back={alone ? backToSettings(t('settings.title')) : undefined}
    >
      <SettingsSplit open="notifications">
        <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
          {alone && <FrameTop />}
          {!alone && (
            <View style={besideRow.row}>
              <View style={styles.shrink}>
                <Text
                  ref={title}
                  size={PANE_TITLE}
                  weight="bold"
                  accessibilityRole="header"
                  style={paneTitle}
                >
                  {t('notificationSettings.title')}
                </Text>
              </View>
              {refreshingWords}
            </View>
          )}
          <View style={styles.blocks}>
            <NotificationsPage watch={watch} refresh={refresh} onLoaded={setLoaded} />
          </View>
        </Screen>
      </SettingsSplit>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1, minWidth: 0 },
  blocks: { gap: 18 },
  phone: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.space3xl,
  },
  portrait: {
    gap: tokens.spaceXl,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space6xl,
  },
  landscape: {
    gap: tokens.spaceXxl,
    paddingTop: 26,
    paddingHorizontal: 30,
    paddingBottom: tokens.space6xl,
  },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
