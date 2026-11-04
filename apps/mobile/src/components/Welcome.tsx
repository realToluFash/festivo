import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { saidOnWelcome } from '../kit/signInRules.ts';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { Brand } from './Brand.tsx';
import { PrimaryButton, QuietButton } from './Buttons.tsx';
import { LanguageChoice } from './LanguageChoice.tsx';
import { ProviderButtons } from './ProviderSignIn.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';

/** Signed out: the brand once, large, and the ways in at the foot (sc-29076). */
export function Welcome({ devTools }: { devTools?: ReactNode }) {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    signedOut?: string;
    providerFailed?: string;
    rule?: string;
    organisation?: string;
    days?: string;
    email?: string;
  }>();
  const [providerFailed, setProviderFailed] = useState(params.providerFailed ?? null);
  const said = saidOnWelcome(params, providerFailed, t);

  return (
    <WelcomeFrame
      top={<LanguageChoice />}
      brand={
        <>
          <WelcomeBrand />
          {said == null ? (
            <Text size={tokens.typeBodyGuest.size} weight="medium" style={styles.tagline}>
              {t('welcome.tagline')}
            </Text>
          ) : (
            <OnBrand title={said[0]} body={said[1]} />
          )}
        </>
      }
      choices={
        <View style={styles.choices}>
          <View style={styles.buttons}>
            <PrimaryButton
              label={t('welcome.withEmail')}
              onPress={() =>
                router.push({
                  pathname: '/sign-in',
                  params: params.email ? { email: params.email } : {},
                })
              }
              testID="welcome.email"
            />
            <ProviderButtons onFailed={setProviderFailed} />
          </View>
          <QuietButton
            label={t('signIn.createAccount')}
            onPress={() => router.push('/register')}
            testID="welcome.register"
          />
          {devTools}
        </View>
      }
    />
  );
}

/** The brand in the middle and the choices in thumb reach; beside each other on a landscape tablet. */
export function WelcomeFrame({
  top,
  brand,
  choices,
}: {
  top?: ReactNode;
  brand: ReactNode;
  choices: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const { width } = useWindowDimensions();
  const side = width < 380 ? tokens.spaceXl : tokens.space3xl;
  const pad = {
    paddingTop: insets.top,
    paddingBottom: Math.max(insets.bottom, tokens.spaceLg),
    paddingLeft: Math.max(insets.left, side),
    paddingRight: Math.max(insets.right, side),
  };

  const body =
    kind === 'tabletLandscape' ? (
      <View style={styles.beside}>
        <View style={styles.half}>{brand}</View>
        <View style={[styles.half, styles.choicesBeside]}>{choices}</View>
      </View>
    ) : kind === 'tabletPortrait' ? (
      <View style={styles.middle}>
        {brand}
        <View style={styles.tabletChoices}>{choices}</View>
      </View>
    ) : (
      <>
        <View style={styles.middle}>{brand}</View>
        {choices}
      </>
    );

  // Scrolls only when it overflows, as at the largest text sizes or under the developer tools.
  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.fill, pad]}>
      <View style={styles.top}>{top}</View>
      {body}
    </ScrollView>
  );
}

export function WelcomeBrand() {
  const { kind } = useLayout();
  const { width } = useWindowDimensions();

  return (
    <Brand
      width={kind === 'phone' ? (width < 380 ? 92 : 112) : 150}
      lockup
      header
      testID="welcome.brand"
    />
  );
}

/** Why somebody is here, in the tagline's place: no box and no mark. */
export function OnBrand({ title, body }: { title: string; body: string }) {
  useReadOut(`${title}. ${body}`);

  return (
    <View style={styles.notice} testID="welcome.notice">
      <Text size={tokens.typeTitleSection.size} weight="semibold" style={styles.centre}>
        {title}
      </Text>
      <Text size={tokens.typeBodyGuest.size} style={[styles.centre, styles.secondary]}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  fill: { flexGrow: 1 },
  top: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceXxl,
    paddingBottom: tokens.spaceLg,
  },
  tabletChoices: { width: 400, marginTop: tokens.space6xl },
  beside: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: tokens.space6xl },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: tokens.spaceXxl },
  choicesBeside: { alignItems: 'stretch', maxWidth: 400 },
  tagline: { textAlign: 'center', color: tokens.colorInkSecondary },
  notice: { maxWidth: 320, gap: tokens.spaceXs, alignItems: 'center' },
  centre: { textAlign: 'center' },
  secondary: { color: tokens.colorInkSecondary },
  choices: { gap: tokens.spaceSm },
  buttons: { gap: tokens.spaceLg },
});
