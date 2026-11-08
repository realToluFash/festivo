import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LanguageChoice } from '../../src/components/LanguageChoice.tsx';
import { Text } from '../../src/components/Text.tsx';
import { OnBrand, useLineSize, WelcomeBrand } from '../../src/components/Welcome.tsx';
import { Choices } from '../../src/demo/Choices.tsx';
import { LegalLinks } from '../../src/demo/LegalLinks.tsx';
import { coverLine, WelcomeFrame } from '../../src/demo/Welcome.tsx';
import { tokens } from '../../src/theme/tokens.ts';

const NOTICES = {
  signedOut: ['You were signed out', 'Sign in again to carry on.'],
  byRule: [
    'Signed out by Ire Events’ rule',
    'Ire Events signs people out after 30 days without use. Sign in again to carry on.',
  ],
} as const;

export default function Welcome() {
  const { notice } = useLocalSearchParams<{ notice?: keyof typeof NOTICES }>();
  const said = notice != null ? NOTICES[notice] : undefined;
  const line = useLineSize();

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

const styles = StyleSheet.create({
  onCover: { color: tokens.colorInkOnDark },
});
