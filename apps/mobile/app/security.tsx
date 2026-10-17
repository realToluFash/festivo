import { type Account, primaryEmailAddress } from '@soirely/api-client';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { QuietButton } from '../src/components/Buttons.tsx';
import { PasswordCard } from '../src/components/PasswordCard.tsx';
import { DevicesCard } from '../src/components/DevicesCard.tsx';
import { Screen } from '../src/components/Screen.tsx';
import { Text } from '../src/components/Text.tsx';
import { TwoFactorCard } from '../src/components/TwoFactorCard.tsx';
import { WaysCard } from '../src/components/WaysCard.tsx';
import { type LayoutKind, useLayout } from '../src/layout/useLayout.ts';
import { tokens } from '../src/theme/tokens.ts';
import { tokens as sessionTokens } from '../src/tokens.ts';

/** `AppSettings-*` state `security` without its tab and rail, until sc-722. */
export default function Security() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const [account, setAccount] = useState<Account | null>(null);
  const [settingPassword, setSettingPassword] = useState(false);
  const [sessionsEnded, setSessionsEnded] = useState(0);

  useEffect(() => {
    let live = true;

    api
      .me()
      .then((me) => {
        if (live) setAccount(me);
      })
      .catch(() => {
        if (live) router.replace('/sign-in');
      });

    return () => {
      live = false;
    };
  }, []);

  const phone = kind === 'phone';
  const signOutHere = () => {
    void api.signOut().finally(() => router.replace('/sign-in'));
  };
  const endedHere = () => {
    void Promise.resolve(sessionTokens.clear()).finally(() => router.replace('/sign-in'));
  };
  const email = account == null ? '' : (primaryEmailAddress(account) ?? '');

  const heading = (
    <>
      <QuietButton
        label={t('security.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        testID="security.back"
      />
      <Text
        size={kind === 'tabletLandscape' ? tokens.typeTitlePage.size : tokens.typeTitlePhone.size}
        weight="bold"
        accessibilityRole="header"
      >
        {t('security.title')}
      </Text>
    </>
  );

  return (
    <Screen style={styles.page} contentStyle={CONTENT[kind]}>
      {phone ? <View style={styles.phoneHeader}>{heading}</View> : heading}
      {account != null && (
        <View style={CARDS[kind]}>
          <PasswordCard
            email={email}
            hasPassword={account.hasPassword}
            providers={account.providers}
            kind={kind}
            onAdded={async () => setAccount(await api.me())}
            setting={settingPassword}
            onSetting={setSettingPassword}
            onChanged={() => setSessionsEnded((n) => n + 1)}
          />
          <WaysCard
            email={email}
            hasPassword={account.hasPassword}
            providers={account.providers}
            kind={kind}
            onChanged={async () => {
              setAccount(await api.me());
              setSessionsEnded((n) => n + 1);
            }}
            onSetPassword={() => setSettingPassword(true)}
            onSignedOutHere={signOutHere}
          />
          <TwoFactorCard email={email} kind={kind} />
          <DevicesCard
            hasPassword={account.hasPassword}
            providers={account.providers}
            kind={kind}
            reload={sessionsEnded}
            onSignOutHere={signOutHere}
            onEndedHere={endedHere}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: tokens.colorPage },
  phoneSecurity: { gap: tokens.spaceLg, paddingBottom: tokens.space3xl },
  phoneHeader: {
    gap: tokens.spaceXs,
    paddingTop: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceLg,
    backgroundColor: tokens.colorHeader,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorHeaderBorder,
  },
  tabletSecurity: { gap: tokens.spaceLg, padding: tokens.space6xl },
  phoneCards: { gap: tokens.spaceLg, paddingHorizontal: tokens.spaceXl },
  tabletCards: { gap: tokens.spaceLg },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phoneSecurity,
  tabletPortrait: styles.tabletSecurity,
  tabletLandscape: styles.tabletSecurity,
};

const CARDS: Record<LayoutKind, object> = {
  phone: styles.phoneCards,
  tabletPortrait: styles.tabletCards,
  tabletLandscape: styles.tabletCards,
};
