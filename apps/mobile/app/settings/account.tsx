import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, FrameTop, besideRow } from '../../src/components/AppFrame.tsx';
import { Refreshing } from '../../src/components/Refreshing.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { AccountPage } from '../../src/components/AccountPage.tsx';
import { Screen } from '../../src/components/Screen.tsx';
import { SettingsSplit, useBackToSettings } from '../../src/components/SettingsList.tsx';
import { Text, type TextHandle } from '../../src/components/Text.tsx';
import { moveScreenReaderFocus } from '../../src/components/screenReaderFocus.ts';
import { useOffline } from '../../src/offline.ts';
import { type LayoutKind, settingsListBeside, useLayout } from '../../src/layout/useLayout.ts';
import { reloadSignedIn, rereadAccount, useSignedIn } from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';
import { PANE_TITLE, paneTitle } from '../../src/components/topTitle.ts';

/** Settings > Your account in the app, summary first: you, About you, then the addresses and numbers (sc-30411). */
export default function Account() {
  const { t } = useTranslation();
  const backToSettings = useBackToSettings();
  const { kind } = useLayout();
  const { account } = useSignedIn();
  const alone = !settingsListBeside(kind);
  const title = useRef<TextHandle>(null);
  const [loaded, setLoaded] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const { watch, stale, refreshing } = useOffline({
    loaded,
    reload: () => setRefresh((n) => n + 1),
    focusTitle: () => moveScreenReaderFocus(title.current),
  });

  // The cards draw the signed-in account; this read is what the offline band dates.
  useEffect(() => {
    let live = true;

    watch(rereadAccount()).then(
      () => live && setLoaded(true),
      () => {},
    );

    return () => {
      live = false;
    };
  }, [refresh, watch]);

  const refreshingWords = refreshing ? <Refreshing testID="account.refreshing" /> : null;

  return (
    <AppFrame
      current="settings"
      top="scrolls"
      aboutTheAccount
      offline={stale}
      besideTitle={alone ? refreshingWords : undefined}
      titleRef={alone ? title : undefined}
      title={alone ? t('account.title') : t('settings.title')}
      back={alone ? backToSettings(t('settings.title')) : undefined}
    >
      <SettingsSplit open="account">
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
                  {t('account.title')}
                </Text>
              </View>
              {refreshingWords}
            </View>
          )}
          {account != null && (
            <View style={styles.blocks}>
              <AccountPage account={account} onChanged={reloadSignedIn} />
            </View>
          )}
        </Screen>
      </SettingsSplit>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1, minWidth: 0 },
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
  blocks: { gap: 18 },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
