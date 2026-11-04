import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Brand } from '../../src/components/Brand.tsx';
import { PrimaryButton, SecondaryButton } from '../../src/components/Buttons.tsx';
import { useReadOut } from '../../src/components/ReadOut.tsx';
import { Text } from '../../src/components/Text.tsx';
import { LanguageButton } from '../../src/demo/LanguageButton.tsx';
import { DemoOnly } from '../../src/steps/Lines.tsx';
import { WelcomeFrame } from '../../src/demo/Welcome.tsx';
import { tokens } from '../../src/theme/tokens.ts';

/** No connection, said on the brand; the app tries again by itself once the connection is back. */
export default function Unreachable() {
  const { signedIn } = useLocalSearchParams<{ signedIn?: string }>();
  const stillIn = signedIn != null;
  const [trying, setTrying] = useState(false);
  const [back, setBack] = useState(false);
  const body = `${stillIn ? 'You are still signed in. ' : ''}Soirely is not answering, so nothing can load yet. Check your connection: the app tries again as soon as it’s back.`;
  useReadOut(`Cannot reach Soirely. ${body}`);

  useEffect(() => {
    if (!trying) return;
    const timer = setTimeout(() => {
      setTrying(false);
      if (back) router.replace(stillIn ? '/demo/home' : '/demo/welcome');
    }, 900);

    return () => clearTimeout(timer);
  }, [back, stillIn, trying]);

  return (
    <WelcomeFrame
      top={stillIn ? undefined : <LanguageButton />}
      brand={
        <>
          <Brand width={112} lockup header />
          <View style={styles.words}>
            <Text size={18} weight="semibold" style={styles.centre}>
              Cannot reach Soirely
            </Text>
            <Text size={16} style={[styles.centre, styles.secondary]}>
              {body}
            </Text>
          </View>
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
        </>
      }
      choices={
        <PrimaryButton
          label={trying ? 'Trying again…' : 'Try again'}
          busy={trying}
          onPress={() => setTrying(true)}
          testID="demo.tryAgain"
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  words: { maxWidth: 320, gap: tokens.spaceXs, alignItems: 'center' },
  centre: { textAlign: 'center' },
  secondary: { color: tokens.colorInkSecondary },
});
