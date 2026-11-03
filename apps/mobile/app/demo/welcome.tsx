import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Brand } from '../../src/components/Brand.tsx';
import { useReadOut } from '../../src/components/ReadOut.tsx';
import { Text } from '../../src/components/Text.tsx';
import { Choices } from '../../src/demo/Choices.tsx';
import { LanguageButton } from '../../src/demo/LanguageButton.tsx';
import { WelcomeFrame } from '../../src/demo/Welcome.tsx';
import { useLayout } from '../../src/layout/useLayout.ts';
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
  const { kind } = useLayout();
  const { width } = useWindowDimensions();
  const said = notice != null ? NOTICES[notice] : undefined;
  const mark = kind === 'phone' ? (width < 380 ? 92 : 112) : 150;

  return (
    <WelcomeFrame
      top={<LanguageButton />}
      brand={
        <>
          <Brand width={mark} lockup header />
          {said != null ? (
            <Notice title={said[0]} body={said[1]} />
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

/** Why the person is here again, in the tagline's place: no box and no mark. */
function Notice({ title, body }: { title: string; body: string }) {
  useReadOut(`${title}. ${body}`);

  return (
    <View style={styles.notice}>
      <Text size={18} weight="semibold" style={styles.centre}>
        {title}
      </Text>
      <Text size={CONTROL} style={[styles.centre, styles.secondary]}>
        {body}
      </Text>
    </View>
  );
}

const CONTROL = 16;

const styles = StyleSheet.create({
  tagline: { textAlign: 'center', color: tokens.colorInkSecondary },
  notice: { maxWidth: 310, gap: tokens.spaceXs, alignItems: 'center' },
  centre: { textAlign: 'center' },
  secondary: { color: tokens.colorInkSecondary },
});
