import { router, useLocalSearchParams } from 'expo-router';
import { type TFunction } from 'i18next';
import { type ReactNode, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { WelcomeFrame } from '../demo/Welcome.tsx';
import { refusalFromParams } from '../kit/signInRules.ts';
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

function saidOnWelcome(
  params: Partial<Record<string, string>>,
  providerFailed: string | null,
  t: TFunction,
): [string, string] | null {
  if (providerFailed != null)
    return [
      t('signIn.providerFailedTitle', { provider: providerFailed }),
      t('signIn.providerFailedBody', { provider: providerFailed }),
    ];

  const refusal = refusalFromParams(params);
  if (refusal?.kind === 'timedOut')
    return [
      t('signIn.timedOutTitle', { organisation: refusal.organisation }),
      t('signIn.timedOutBody', { organisation: refusal.organisation, count: refusal.days }),
    ];

  return params.signedOut == null ? null : [t('signIn.endedTitle'), t('signIn.endedBody')];
}

const styles = StyleSheet.create({
  tagline: { textAlign: 'center', color: tokens.colorInkSecondary },
  notice: { maxWidth: 320, gap: tokens.spaceXs, alignItems: 'center' },
  centre: { textAlign: 'center' },
  secondary: { color: tokens.colorInkSecondary },
  choices: { gap: tokens.spaceSm },
  buttons: { gap: tokens.spaceLg },
});
