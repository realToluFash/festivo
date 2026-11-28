import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { QuietButton } from '../../../src/components/Buttons.tsx';
import { CodeBoxes, type CodeBoxesHandle } from '../../../src/steps/CodeBoxes.tsx';
import { DemoScreen, NavBar } from '../../../src/demo/DemoScreen.tsx';
import { Confirmed, Heading, Plain, Says } from '../../../src/steps/Lines.tsx';
import { minutesSeconds, RESEND_SECONDS } from '../../../src/steps/rules.ts';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { useCountdown } from '../../../src/steps/useCountdown.ts';
import { tokens } from '../../../src/theme/tokens.ts';

const NEXT = { invited: '/demo/invited', join: '/demo/join-message' } as const;

export default function EmailCode() {
  const params = useLocalSearchParams<{
    email?: string;
    name?: string;
    after?: string;
    state?: string;
  }>();
  const email = params.email ?? SAMPLE.email;
  // A sign-up held 24 hours for this code has run out: the sixth digit and Send a new code both end it (sc-29923).
  const runOut = params.state === 'runOut';
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const [done, setDone] = useState(false);
  const [resent, setResent] = useState(false);
  const boxes = useRef<CodeBoxesHandle>(null);
  const { left, restart } = useCountdown(runOut ? 0 : RESEND_SECONDS);

  function timedOut(): void {
    router.replace({
      pathname: '/demo/create',
      params: { state: 'timedOut', name: params.name ?? SAMPLE.name, email },
    });
  }

  function check(full: string): void {
    if (runOut) return timedOut();
    if (full !== SAMPLE.code) {
      setWrong(true);
      boxes.current?.refuse();
      return;
    }
    setDone(true);
    const next = NEXT[params.after as keyof typeof NEXT] ?? '/demo/organisation';
    setTimeout(() => router.replace({ pathname: next, params: { email } }), 500);
  }

  return (
    <DemoScreen nav={<NavBar step={[done ? 2.5 : 2, 4]} />}>
      <Heading title="Check your email" intro={`We sent a code to ${email}.`} />
      <View style={styles.boxes}>
        <CodeBoxes
          ref={boxes}
          label="Code, 6 digits"
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
          <Says words="That code does not match. Check the newest email from Soirely and try again." />
        )}
        {done && <Confirmed words="Email confirmed" />}
        {resent && !wrong && !done && <Plain>We sent a new code. Use the newest email.</Plain>}
      </View>
      {!done && (
        <View style={styles.ways}>
          <QuietButton
            label={left > 0 ? `Send a new code in ${minutesSeconds(left)}` : 'Send a new code'}
            off={left > 0}
            onPress={() => {
              if (runOut) return timedOut();
              restart();
              setResent(true);
            }}
            testID="demo.resend"
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
