import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, FrameTop, besideRow } from '../../src/components/AppFrame.tsx';
import { Refreshing } from '../../src/components/Refreshing.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { SETTINGS_PAGE } from '../../src/components/listFrame.ts';
import { Screen } from '../../src/components/Screen.tsx';
import { SecurityPage } from '../../src/components/SecurityPage.tsx';
import { SettingsSplit, useBackToSettings } from '../../src/components/SettingsList.tsx';
import { Text, type TextHandle } from '../../src/components/Text.tsx';
import { moveScreenReaderFocus } from '../../src/components/screenReaderFocus.ts';
import { useOffline } from '../../src/offline.ts';
import { settingsListBeside, useLayout } from '../../src/layout/useLayout.ts';
import {
  endedHere,
  reloadSignedIn,
  rereadAccount,
  signOutHere,
  useSignedIn,
} from '../../src/signedIn.ts';
import { PANE_TITLE, paneTitle } from '../../src/components/topTitle.ts';

/** Settings > Security in the app, summary first: the card, the ways in, two-factor and the devices (sc-30411). */
export default function Security() {
  const { t } = useTranslation();
  const backToSettings = useBackToSettings();
  const { kind } = useLayout();
  const { account, organisations } = useSignedIn();
  const alone = !settingsListBeside(kind);
  const title = useRef<TextHandle>(null);
  const [loaded, setLoaded] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const { watch, stale, refreshing } = useOffline({
    loaded,
    reload: () => setRefresh((n) => n + 1),
    focusTitle: () => moveScreenReaderFocus(title.current),
  });

  const refreshingWords = refreshing ? <Refreshing testID="security.refreshing" /> : null;

  return (
    <AppFrame
      current="settings"
      top="scrolls"
      listUnderTabs
      aboutTheAccount
      offline={stale}
      besideTitle={alone ? refreshingWords : undefined}
      titleRef={alone ? title : undefined}
      title={alone ? t('security.title') : t('settings.title')}
      back={alone ? backToSettings(t('settings.title')) : undefined}
    >
      <SettingsSplit open="security">
        <Screen edges={bodyEdges(kind)} contentStyle={SETTINGS_PAGE[kind]}>
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
                  {t('security.title')}
                </Text>
              </View>
              {refreshingWords}
            </View>
          )}
          {account != null && (
            <View style={styles.blocks}>
              <SecurityPage
                account={account}
                organisations={organisations}
                watch={watch}
                refresh={refresh}
                onLoaded={setLoaded}
                onChanged={reloadSignedIn}
                onRefused={rereadAccount}
                onSignOutHere={signOutHere}
                onEndedHere={endedHere}
              />
            </View>
          )}
        </Screen>
      </SettingsSplit>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1, minWidth: 0 },
  blocks: { gap: 18 },
});
