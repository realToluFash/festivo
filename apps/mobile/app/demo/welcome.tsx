import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Text } from '../../src/components/Text.tsx';
import { Choices } from '../../src/demo/Choices.tsx';
import { LanguageButton } from '../../src/demo/LanguageButton.tsx';
import { OnBrand, WelcomeBrand, WelcomeFrame } from '../../src/components/Welcome.tsx';
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

  return (
    <WelcomeFrame
      top={<LanguageButton />}
      brand={
        <>
          <WelcomeBrand />
          {said != null ? (
            <OnBrand title={said[0]} body={said[1]} />
          ) : (
            <Text size={tokens.typeBodyGuest.size} weight="medium" style={styles.tagline}>
              Plan the event. Run the night.
            </Text>
          )}
        </>
      }
      choices={
        <Choices
          onEmail={() => router.push('/demo/sign-in')}
          onApple={() => router.push('/demo/apple')}
          onGoogle={() => router.push('/demo/organisation?via=google')}
          onCreate={() => router.push('/demo/create')}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  tagline: { textAlign: 'center', color: tokens.colorInkSecondary },
});
