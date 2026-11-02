import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame } from '../../src/components/AppFrame.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { ContactsCards } from '../../src/components/ContactsCard.tsx';
import { NameCard } from '../../src/components/NameCard.tsx';
import { Screen } from '../../src/components/Screen.tsx';
import { SettingsSplit, useBackToSettings } from '../../src/components/SettingsList.tsx';
import { Text, type TextHandle } from '../../src/components/Text.tsx';
import { moveScreenReaderFocus } from '../../src/components/screenReaderFocus.ts';
import { useOffline } from '../../src/offline.ts';
import { TimeZoneCard } from '../../src/components/TimeZoneCard.tsx';
import { type LayoutKind, settingsListBeside, useLayout } from '../../src/layout/useLayout.ts';
import { reloadSignedIn, rereadAccount, useSignedIn } from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** Settings > Account in the app: the name (sc-22741), the address and phone cards (sc-113), then the time zone (sc-868). */
export default function Account() {
  const { t } = useTranslation();
  const backToSettings = useBackToSettings();
  const { kind } = useLayout();
  const { account } = useSignedIn();
  // Set by a verify screen popping back here; a new value starts the cards afresh, to say so.
  const { verified } = useLocalSearchParams<{ verified?: string }>();
  const alone = !settingsListBeside(kind);
  const title = useRef<TextHandle>(null);
  const [loaded, setLoaded] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const { watch, stale } = useOffline({
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

  return (
    <AppFrame
      current="settings"
      aboutTheAccount
      offline={stale}
      titleRef={alone ? title : undefined}
      title={alone ? t('account.title') : t('settings.title')}
      back={alone ? backToSettings(t('settings.title')) : undefined}
    >
      <SettingsSplit open="account">
        <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
          {!alone && (
            <Text
              ref={title}
              size={tokens.typeTitlePage.size}
              weight="bold"
              accessibilityRole="header"
            >
              {t('account.title')}
            </Text>
          )}
          {account != null && (
            <View style={styles.cards}>
              <NameCard name={account.name} kind={kind} onSaved={reloadSignedIn} />
              <ContactsCards
                key={verified ?? ''}
                account={account}
                kind={kind}
                verified={verified ?? null}
                onChanged={reloadSignedIn}
              />
              <TimeZoneCard timezone={account.timezone} kind={kind} onSaved={reloadSignedIn} />
            </View>
          )}
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
  cards: { gap: tokens.spaceLg },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
