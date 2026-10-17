import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, bodyEdges } from '../../src/components/AppFrame.tsx';
import { Screen } from '../../src/components/Screen.tsx';
import { SettingsSplit, backToSettings } from '../../src/components/SettingsList.tsx';
import { Text } from '../../src/components/Text.tsx';
import { TimeZoneCard } from '../../src/components/TimeZoneCard.tsx';
import { type LayoutKind, useLayout } from '../../src/layout/useLayout.ts';
import { reloadSignedIn, useSignedIn } from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** Settings > Account in the app: the time zone card (sc-868); the address cards are sc-113's. */
export default function Account() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { account } = useSignedIn();
  const phone = kind === 'phone';

  return (
    <AppFrame
      current="settings"
      title={phone ? t('account.title') : t('settings.title')}
      back={phone ? backToSettings(t('settings.title')) : undefined}
    >
      <SettingsSplit open="account">
        <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
          {!phone && (
            <Text
              size={
                kind === 'tabletLandscape' ? tokens.typeTitlePage.size : tokens.typeTitlePhone.size
              }
              weight="bold"
              accessibilityRole="header"
            >
              {t('account.title')}
            </Text>
          )}
          {account != null && (
            <View style={styles.cards}>
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
