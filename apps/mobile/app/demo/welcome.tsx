import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { LanguageChoice } from '../../src/components/LanguageChoice.tsx';
import { Text } from '../../src/components/Text.tsx';
import { OnBrand, useLineSize, WelcomeBrand } from '../../src/components/Welcome.tsx';
import { withBoldText } from '../../src/demo/boldText/BoldTextSwitch.tsx';
import { Choices } from '../../src/demo/Choices.tsx';
import { LegalLinks } from '../../src/demo/LegalLinks.tsx';
import { SAMPLE } from '../../src/demo/samples.ts';
import { coverLine, WelcomeFrame } from '../../src/demo/Welcome.tsx';
import { tokens } from '../../src/theme/tokens.ts';

const NOTICES = {
  signedOut: ['You were signed out', 'Sign in again to carry on.'],
  byRule: [
    'Signed out by Ire Events’ rule',
    'Ire Events signs people out after 30 days without use. Sign in again to carry on.',
  ],
} as const;

/** Sign in opens over welcome, so the iPad draws it as the sheet sc-29076 settled rather than full screen. */
const SIGN_IN = {
  email: '/demo/sign-in',
  timedOut: `/demo/sign-in?timedOut=1&email=${SAMPLE.email}`,
} as const;

function Welcome() {
  const { notice, signIn } = useLocalSearchParams<{
    notice?: keyof typeof NOTICES;
    signIn?: keyof typeof SIGN_IN;
  }>();
  const said = notice != null ? NOTICES[notice] : undefined;
  const line = useLineSize();

  useEffect(() => {
    if (signIn != null && signIn in SIGN_IN) router.push(SIGN_IN[signIn]);
  }, [signIn]);

  return (
    <WelcomeFrame
      cover
      top={<LanguageChoice />}
      brand={
        <>
          <WelcomeBrand />
          {said != null ? (
            <OnBrand title={said[0]} body={said[1]} size={line} />
          ) : (
            <Text
              weight="bold"
              size={line}
              maxFontSizeMultiplier={1.25}
              style={[styles.onCover, coverLine(line)]}
            >
              {'Plan the event.\nRun the day.'}
            </Text>
          )}
        </>
      }
      choices={
        <View>
          <Choices
            onEmail={() => router.push('/demo/sign-in')}
            onApple={() => router.push('/demo/apple')}
            onGoogle={() => router.push('/demo/organisation?via=google')}
            onCreate={() => router.push('/demo/create')}
            onJoinCode={() => router.push('/demo/redeem?state=enter')}
          />
          {/* Under the last button: Google and Apple make an account from here too (sc-29938). */}
          <LegalLinks />
        </View>
      }
    />
  );
}

export default withBoldText(Welcome, 'left');

const styles = StyleSheet.create({
  onCover: { color: tokens.colorInkOnDark },
});
