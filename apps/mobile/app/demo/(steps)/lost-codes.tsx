import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton, QuietButton } from '../../../src/components/Buttons.tsx';
import { CodeBoxes, type CodeBoxesHandle, CodeLabel } from '../../../src/steps/CodeBoxes.tsx';
import { DemoScreen, NavBar } from '../../../src/demo/DemoScreen.tsx';
import { Heading, Plain, Says } from '../../../src/steps/Lines.tsx';
import { CODE_LENGTH, minutesSeconds, RESEND_SECONDS } from '../../../src/steps/rules.ts';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { useCountdown } from '../../../src/steps/useCountdown.ts';
import { tokens } from '../../../src/theme/tokens.ts';

type Which = 'email' | 'text';

export default function LostCodes() {
  const params = useLocalSearchParams<{ email?: string; emailOnly?: string }>();
  const email = params.email ?? SAMPLE.email;
  const emailOnly = params.emailOnly != null;
  const [codes, setCodes] = useState<Record<Which, string>>({ email: '', text: '' });
  const [said, setSaid] = useState<{ which: Which; words: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const boxes = { email: useRef<CodeBoxesHandle>(null), text: useRef<CodeBoxesHandle>(null) };
  const { left, restart } = useCountdown(RESEND_SECONDS);
  const needed: readonly Which[] = emailOnly ? ['email'] : ['email', 'text'];

  function ask(): void {
    if (busy) return;
    const missing = needed.find((which) => codes[which].length < CODE_LENGTH);
    if (missing != null) {
      setSaid({
        which: missing,
        words: emailOnly ? 'Enter the code.' : `Enter the code from the ${missing}.`,
      });
      boxes[missing].current?.focus();
      return;
    }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      const wrong = needed.find((which) => codes[which] !== SAMPLE.code);
      if (wrong != null) {
        setSaid({
          which: wrong,
          words: `That code does not match. Check the newest ${wrong === 'email' ? 'email' : 'text'} from Soirely.`,
        });
        boxes[wrong].current?.refuse();
        boxes[wrong].current?.focus();
        return;
      }
      router.replace({ pathname: '/demo/waiting', params: { email } });
    }, 700);
  }

  const box = (which: Which, label: string, first: boolean) => (
    <View>
      {!emailOnly && <CodeLabel words={label} />}
      <CodeBoxes
        ref={boxes[which]}
        label={`${label}, 6 digits`}
        value={codes[which]}
        onChange={(next) => {
          setCodes((now) => ({ ...now, [which]: next }));
          if (next !== '' && said?.which === which) setSaid(null);
        }}
        onFull={() => {
          if (which === 'email' && !emailOnly) boxes.text.current?.focus();
        }}
        autoFocus={first}
        testID={`demo.code.${which}`}
      />
      {said?.which === which && <Says words={said.words} />}
    </View>
  );

  return (
    <DemoScreen
      nav={<NavBar step={[2, 3]} />}
      foot={
        <PrimaryButton
          label={busy ? 'Asking…' : 'Ask to get back in'}
          busy={busy}
          onPress={ask}
          testID="demo.ask"
        />
      }
    >
      <Heading
        title={emailOnly ? 'Enter the code' : 'Enter both codes'}
        intro={
          emailOnly
            ? `We sent a code to ${email}.`
            : `We sent a code to ${email} and another to ${SAMPLE.phoneShown}. You need both.`
        }
      />
      <View style={styles.codes}>
        {box('email', 'Code from the email', true)}
        {!emailOnly && box('text', 'Code from the text', false)}
      </View>
      <View style={styles.ways}>
        <QuietButton
          label={
            left > 0
              ? `${emailOnly ? 'Send a new code' : 'Send new codes'} in ${minutesSeconds(left)}`
              : emailOnly
                ? 'Send a new code'
                : 'Send new codes'
          }
          off={left > 0}
          onPress={() => restart()}
          testID="demo.resend"
        />
      </View>
      <Plain>
        {emailOnly ? 'A new code replaces the last one.' : 'New codes replace the last ones.'}
      </Plain>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  codes: { marginTop: tokens.spaceXl },
  ways: { marginTop: tokens.spaceLg, alignItems: 'flex-start' },
});
