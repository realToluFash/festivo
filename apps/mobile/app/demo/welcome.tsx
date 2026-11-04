import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Brand } from '../../src/components/Brand.tsx';
import { useReadOut } from '../../src/components/ReadOut.tsx';
import { Text } from '../../src/components/Text.tsx';
import { Choices } from '../../src/demo/Choices.tsx';
import { LanguageButton } from '../../src/demo/LanguageButton.tsx';
import { coverLine, WelcomeFrame } from '../../src/demo/Welcome.tsx';
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
  const mark = kind === 'phone' ? (width < 380 ? 92 : 112) : 140;
  const line = kind === 'phone' ? (width < 380 ? 26 : 32) : 46;

  return (
    <WelcomeFrame
      cover
      top={<LanguageButton />}
      brand={
        <>
          <Brand width={mark} lockup header ink={tokens.colorInkOnDark} />
          {said != null ? (
            <Notice title={said[0]} body={said[1]} size={line} />
          ) : (
            <Text
              weight="bold"
              size={line}
              maxFontSizeMultiplier={1.25}
              accessibilityRole="header"
              style={[styles.onCover, coverLine(line)]}
            >
              {'Plan the event.\nRun the day.'}
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
function Notice({ title, body, size }: { title: string; body: string; size: number }) {
  useReadOut(`${title}. ${body}`);

  return (
    <View style={styles.notice}>
      <Text
        weight="bold"
        size={size}
        maxFontSizeMultiplier={1.25}
        style={[styles.onCover, coverLine(size)]}
      >
        {title}
      </Text>
      <Text size={size < 40 ? CONTROL : 19} style={[styles.onCover, styles.centre]}>
        {body}
      </Text>
    </View>
  );
}

const CONTROL = 16;

const styles = StyleSheet.create({
  onCover: { color: tokens.colorInkOnDark },
  notice: { maxWidth: 330, gap: tokens.spaceSm, alignItems: 'center' },
  centre: { textAlign: 'center' },
});
