import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { QuietButton } from '../../../src/components/Buttons.tsx';
import { CodeBoxes, type CodeBoxesHandle } from '../../../src/steps/CodeBoxes.tsx';
import { DemoScreen, NavBar, finish } from '../../../src/demo/DemoScreen.tsx';
import { Confirmed, Heading, Says } from '../../../src/steps/Lines.tsx';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { tokens } from '../../../src/theme/tokens.ts';

export default function TwoFactor() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? SAMPLE.email;
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const [done, setDone] = useState(false);
  const boxes = useRef<CodeBoxesHandle>(null);

  function check(full: string): void {
    if (full !== SAMPLE.authenticator) {
      setWrong(true);
      boxes.current?.refuse();
      return;
    }
    setDone(true);
    setTimeout(() => finish(), 500);
  }

  return (
    <DemoScreen nav={<NavBar />}>
      <Heading
        title="Enter your code"
        intro={`Open your authenticator app and enter the code for ${email}.`}
      />
      <View style={styles.boxes}>
        <CodeBoxes
          ref={boxes}
          label="Authenticator code, 6 digits"
          value={code}
          onChange={(next) => {
            setCode(next);
            if (next !== '') setWrong(false);
          }}
          onFull={check}
          done={done}
          testID="demo.code"
        />
        {wrong && (
          <Says words="That code does not match. Codes change every 30 seconds, so use the newest one." />
        )}
        {done && <Confirmed words="Signed in" />}
      </View>
      {!done && (
        <View style={styles.ways}>
          <QuietButton
            label="Use a recovery code instead"
            onPress={() => router.push({ pathname: '/demo/recovery', params: { email } })}
            testID="demo.recovery"
          />
          <QuietButton
            label="Lost your authenticator?"
            onPress={() => router.push({ pathname: '/demo/lost', params: { email } })}
            testID="demo.lost"
          />
        </View>
      )}
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  boxes: { marginTop: tokens.space4xl },
  ways: { marginTop: tokens.spaceLg, alignItems: 'flex-start' },
});
