import { type Account as AccountShape } from '@soirely/api-client';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { QuietButton } from '../src/components/Buttons.tsx';
import { Screen } from '../src/components/Screen.tsx';
import { Text } from '../src/components/Text.tsx';
import { TimeZoneCard } from '../src/components/TimeZoneCard.tsx';
import { type LayoutKind, useLayout } from '../src/layout/useLayout.ts';
import { tokens } from '../src/theme/tokens.ts';

/** Your account > Account in the app: the time zone card (sc-868); the address cards are sc-113's. */
export default function Account() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const [account, setAccount] = useState<AccountShape | null>(null);

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

  const heading = (
    <>
      <QuietButton
        label={t('account.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        testID="account.back"
      />
      <Text
        size={kind === 'tabletLandscape' ? tokens.typeTitlePage.size : tokens.typeTitlePhone.size}
        weight="bold"
        accessibilityRole="header"
      >
        {t('account.title')}
      </Text>
    </>
  );

  return (
    <Screen style={styles.page} contentStyle={CONTENT[kind]}>
      {phone ? <View style={styles.phoneHeader}>{heading}</View> : heading}
      {account != null && (
        <View style={CARDS[kind]}>
          <TimeZoneCard
            timezone={account.timezone}
            kind={kind}
            onSaved={async () => setAccount(await api.me())}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: tokens.colorPage },
  phoneAccount: { gap: tokens.spaceLg, paddingBottom: tokens.space3xl },
  phoneHeader: {
    gap: tokens.spaceXs,
    paddingTop: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceLg,
    backgroundColor: tokens.colorHeader,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorHeaderBorder,
  },
  tabletAccount: { gap: tokens.spaceLg, padding: tokens.space6xl },
  phoneCards: { gap: tokens.spaceLg, paddingHorizontal: tokens.spaceXl },
  tabletCards: { gap: tokens.spaceLg },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phoneAccount,
  tabletPortrait: styles.tabletAccount,
  tabletLandscape: styles.tabletAccount,
};

const CARDS: Record<LayoutKind, object> = {
  phone: styles.phoneCards,
  tabletPortrait: styles.tabletCards,
  tabletLandscape: styles.tabletCards,
};
