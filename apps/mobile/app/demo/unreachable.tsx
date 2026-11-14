import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Brand } from '../../src/components/Brand.tsx';
import { PrimaryButton, SecondaryButton } from '../../src/components/Buttons.tsx';
import { LanguageChoice } from '../../src/components/LanguageChoice.tsx';
import { OnBrand } from '../../src/components/Welcome.tsx';
import { DemoOnly } from '../../src/steps/Lines.tsx';
import { WelcomeFrame } from '../../src/demo/Welcome.tsx';
import { useLayout } from '../../src/layout/useLayout.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** No connection, said on the brand; the app tries again by itself once the connection is back. */
export default function Unreachable() {
  const { signedIn, back: from } = useLocalSearchParams<{ signedIn?: string; back?: string }>();
  const stillIn = signedIn != null;
  const home: Href = from?.startsWith('/demo/')
    ? (from as Href)
    : stillIn
      ? '/demo/today'
      : '/demo/welcome';
  const [trying, setTrying] = useState(false);
  const [back, setBack] = useState(false);
  const body = `${stillIn ? 'You are still signed in. ' : ''}Soirely is not answering, so nothing can load yet. Check your connection: the app tries again as soon as it’s back.`;
  const tablet = useLayout().kind !== 'phone';
  const line = tablet ? tokens.typeCoverTitleTablet.size : tokens.typeCoverTitle.size;

  useEffect(() => {
    if (!trying) return;
    const timer = setTimeout(() => {
      setTrying(false);
      if (back) router.replace(home);
    }, 900);

    return () => clearTimeout(timer);
  }, [back, home, trying]);

  return (
    <WelcomeFrame
      cover
      top={stillIn ? undefined : <LanguageChoice />}
      brand={
        <>
          <Brand width={tablet ? 140 : 112} lockup header ink={tokens.colorInkOnDark} />
          <OnBrand title="Cannot reach Soirely" body={body} size={line} />
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
  choices: { gap: tokens.spaceLg },
});
