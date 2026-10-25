import { primaryEmailAddress } from '@soirely/api-client';
import { roleName } from '@soirely/domain';
import { router } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DESTINATION_HREF } from '../kit/appNav.ts';
import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AppFrame, useOpenSwitcher } from './AppFrame.tsx';
import { bodyEdges } from './bodyEdges.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { LinkedNotice } from './LinkedNotice.tsx';
import { NoOrganisation } from './NoOrganisation.tsx';
import { Screen } from './Screen.tsx';
import { SignInRulesNotices } from './SignInRulesNotices.tsx';
import { cardFrame } from './cardFrame.ts';
import { Text } from './Text.tsx';

/** The signed-in home, `AppSettings-*` state `home`: where the app opens once somebody is in. */
export function Home() {
  const { t } = useTranslation();

  return (
    <AppFrame current="home" title={t('frame.home')}>
      <HomeBody />
    </AppFrame>
  );
}

function HomeBody() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { account, organisation } = useSignedIn();
  const openSwitcher = useOpenSwitcher();
  const switchButton = useRef<View>(null);

  return (
    <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
      <LinkedNotice />
      {organisation != null && (
        <SignInRulesNotices key={organisation.id} organisation={organisation} />
      )}
      {account != null && organisation == null && <NoOrganisation />}
      {account != null && organisation != null && (
        <View style={[cardFrame(kind), styles.card]}>
          <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
            {t('home.signedInTo', { name: organisation.name })}
          </Text>
          <View style={styles.lines}>
            <Text size={tokens.typeBodyPhone.size}>
              {t('switcher.yourRole', { role: roleName(t, organisation.role) })}
            </Text>
            <Text size={tokens.typeBodyPhone.size} muted>
              {t('settings.signedInAs', { email: primaryEmailAddress(account) ?? '' })}
            </Text>
          </View>
          <View style={styles.actions}>
            <PrimaryButton
              label={t('home.openSettings')}
              onPress={() => router.navigate(DESTINATION_HREF.settings)}
              testID="home.openSettings"
            />
            {openSwitcher != null && (
              <SecondaryButton
                label={t('home.switchOrganisation')}
                onPress={() => openSwitcher(switchButton)}
                ref={switchButton}
                testID="home.switchOrganisation"
              />
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  phone: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXxl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  portrait: {
    gap: tokens.spaceXl,
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.space4xl,
    paddingBottom: tokens.space6xl,
  },
  landscape: {
    gap: tokens.spaceXxl,
    paddingTop: tokens.space4xl,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space6xl,
  },
  card: { gap: 14 },
  lines: { gap: tokens.spaceXxs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
