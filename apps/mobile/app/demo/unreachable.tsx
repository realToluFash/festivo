import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Brand } from '../../src/components/Brand.tsx';
import { PrimaryButton, SecondaryButton } from '../../src/components/Buttons.tsx';
import { useReadOut } from '../../src/components/ReadOut.tsx';
import { Text } from '../../src/components/Text.tsx';
import { LanguageButton } from '../../src/demo/LanguageButton.tsx';
import { DemoOnly } from '../../src/steps/Lines.tsx';
import { coverLine, WelcomeFrame } from '../../src/demo/Welcome.tsx';
import { useLayout } from '../../src/layout/useLayout.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** No connection, said on the brand; the app tries again by itself once the connection is back. */
export default function Unreachable() {
  const { signedIn } = useLocalSearchParams<{ signedIn?: string }>();
  const stillIn = signedIn != null;
  const [trying, setTrying] = useState(false);
  const [back, setBack] = useState(false);
  const body = `${stillIn ? 'You are still signed in. ' : ''}Soirely is not answering, so nothing can load yet. Check your connection: the app tries again as soon as it’s back.`;
  useReadOut(`Cannot reach Soirely. ${body}`);
  const tablet = useLayout().kind !== 'phone';
  const line = tablet ? 40 : 28;

  useEffect(() => {
    if (!trying) return;
    const timer = setTimeout(() => {
      setTrying(false);
      if (back) router.replace(stillIn ? '/demo/today' : '/demo/welcome');
    }, 900);

    return () => clearTimeout(timer);
  }, [back, stillIn, trying]);

  return (
    <WelcomeFrame
      cover
      top={stillIn ? undefined : <LanguageButton />}
      brand={
        <>
          <Brand width={tablet ? 140 : 112} lockup header ink={tokens.colorInkOnDark} />
          <View style={styles.words}>
            <Text
              weight="bold"
              size={line}
              maxFontSizeMultiplier={1.25}
              accessibilityRole="header"
              style={[styles.onCover, coverLine(line)]}
            >
              Cannot reach Soirely
            </Text>
            <Text size={tablet ? 19 : 16} style={[styles.centre, styles.onCover]}>
              {body}
            </Text>
          </View>
        </>
      }
      choices={
        <View style={styles.choices}>
          <PrimaryButton
            label={trying ? 'Trying again…' : 'Try again'}
            busy={trying}
            onPress={() => setTrying(true)}
            testID="demo.tryAgain"
          />
          <DemoOnly title="Demo: the connection">
            <SecondaryButton
              label="Bring it back"
              onPress={() => {
                setBack(true);
                setTrying(true);
              }}
              testID="demo.connectionBack"
            />
          </DemoOnly>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  words: { maxWidth: 340, gap: tokens.spaceSm, alignItems: 'center' },
  centre: { textAlign: 'center' },
  onCover: { color: tokens.colorInkOnDark },
  choices: { gap: tokens.spaceLg },
});
