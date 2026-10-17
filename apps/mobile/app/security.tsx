import { type Account, primaryEmailAddress } from '@soirely/api-client';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { QuietButton } from '../src/components/Buttons.tsx';
import { PasswordCard } from '../src/components/PasswordCard.tsx';
import { Screen } from '../src/components/Screen.tsx';
import { Text } from '../src/components/Text.tsx';
import { TwoFactorCard } from '../src/components/TwoFactorCard.tsx';
import { type LayoutKind, useLayout } from '../src/layout/useLayout.ts';
import { tokens } from '../src/theme/tokens.ts';

/** `AppSettings-*` state `security` without its tab and rail, until sc-722; later cards join the stack. */
export default function Security() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const [account, setAccount] = useState<Account | null>(null);

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
          />
          <TwoFactorCard email={email} kind={kind} />
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
