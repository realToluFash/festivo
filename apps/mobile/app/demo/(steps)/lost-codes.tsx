import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton, QuietButton, SecondaryButton } from '../../../src/components/Buttons.tsx';
import { Notice } from '../../../src/components/Notice.tsx';
import { Text } from '../../../src/components/Text.tsx';
import { CodeBoxes, type CodeBoxesHandle, CodeLabel } from '../../../src/steps/CodeBoxes.tsx';
import { DemoScreen, NavBar } from '../../../src/demo/DemoScreen.tsx';
import {
  CODE_SHORT,
  type CodeBox,
  type Spent,
  type Tries,
  boxWords,
  codeWords,
  newCode,
  spentWords,
  wrongAsk,
} from '../../../src/demo/lostAuth.ts';
import { DemoOnly, Heading, Says } from '../../../src/steps/Lines.tsx';
import { CODE_LENGTH, minutesSeconds, RESEND_SECONDS } from '../../../src/steps/rules.ts';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { useCountdown } from '../../../src/steps/useCountdown.ts';
import { tokens } from '../../../src/theme/tokens.ts';

function opening(state: string | undefined): Spent | null {
  return state === 'expired' || state === 'exhausted' ? state : null;
}

/** `state=expired` or `state=exhausted` opens with the codes spent, as five wrong asks leave them. Nobody left to confirm ends the request here, before it waits (sc-29072). */
export default function LostCodes() {
  const params = useLocalSearchParams<{ email?: string; emailOnly?: string; state?: string }>();
  const email = params.email ?? SAMPLE.email;
  const emailOnly = params.emailOnly != null;
  const words = codeWords(emailOnly);
  const [codes, setCodes] = useState<Record<CodeBox, string>>({ email: '', text: '' });
  const [said, setSaid] = useState<{ which: CodeBox; words: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [texted, setTexted] = useState(false);
  const [tries, setTries] = useState<Tries>(() => ({ wrongs: 0, spent: opening(params.state) }));
  const spent = tries.spent;
  const boxes = { email: useRef<CodeBoxesHandle>(null), text: useRef<CodeBoxesHandle>(null) };
  const { left, restart } = useCountdown(RESEND_SECONDS);
  const needed: readonly CodeBox[] = emailOnly ? ['email'] : ['email', 'text'];
  const wordsFor = (which: CodeBox) =>
    boxWords(which, texted, which === 'email' ? email : SAMPLE.phoneShown);

  function ask(): void {
    if (busy) return;
    const missing = needed.find((which) => codes[which].length < CODE_LENGTH);
    if (missing != null) {
      setSaid({
        which: missing,
        words: codes[missing] === '' ? wordsFor(missing).blank : CODE_SHORT,
      });
      boxes[missing].current?.focus();
      return;
    }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      const wrong = needed.find((which) => codes[which] !== SAMPLE.code);
      if (wrong != null) {
        const next = wrongAsk(tries);
        setTries(next);
        if (next.spent != null) {
          setSaid(null);
          return;
        }
        setSaid({ which: wrong, words: wordsFor(wrong).wrong });
        boxes[wrong].current?.refuse();
        boxes[wrong].current?.focus();
        return;
      }
      router.replace({ pathname: '/demo/waiting', params: { email } });
    }, 700);
  }

  function sendNew(): void {
    setTries(newCode());
    setCodes({ email: '', text: '' });
    setSaid(null);
    restart();
    boxes.email.current?.focus();
  }

  const box = (which: CodeBox, first: boolean) => {
    const { label, sent } = wordsFor(which);

    return (
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
        <Text size={tokens.typeSmall.size} style={styles.small}>
          {sent}
        </Text>
      </View>
    );
  };
  const dead = spent == null ? null : spentWords(spent, emailOnly);

  return (
    <DemoScreen
      nav={<NavBar step={[2, 3]} />}
      foot={
        dead != null ? (
          <PrimaryButton label={words.resend} onPress={sendNew} testID="demo.sendNew" />
        ) : (
          <PrimaryButton
            label={busy ? 'Asking…' : 'Ask to get back in'}
            busy={busy}
            onPress={ask}
            testID="demo.ask"
          />
        )
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
      {dead != null ? (
        <View style={styles.spent}>
          <Notice tone="attention" mark="!" title={dead.title} body={dead.body} announce />
        </View>
      ) : (
        <>
          <View style={styles.codes}>
            {box('email', true)}
            {!emailOnly && box('text', false)}
          </View>
          <View style={styles.ways}>
            <QuietButton
              label={left > 0 ? `${words.resend} in ${minutesSeconds(left)}` : words.resend}
              off={left > 0}
              onPress={sendNew}
              testID="demo.resend"
            />
          </View>
          <Text size={tokens.typeSmall.size} style={styles.small}>
            {emailOnly ? 'A new code replaces the last one.' : 'New codes replace the last ones.'}
          </Text>
          {!emailOnly && !texted && (
            <View style={styles.ways}>
              <QuietButton
                label="Text it to me instead"
                onPress={() => {
                  setTexted(true);
                  boxes.text.current?.focus();
                }}
                testID="demo.textInstead"
              />
            </View>
          )}
        </>
      )}
      <DemoOnly title={`Demo: nobody in ${SAMPLE.organisation} can confirm`}>
        <SecondaryButton
          label="Nobody can confirm"
          onPress={() =>
            router.replace({ pathname: '/demo/ending', params: { kind: 'nobody', email } })
          }
          testID="demo.nobody"
        />
      </DemoOnly>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  codes: { marginTop: tokens.spaceXl },
  spent: { marginTop: tokens.spaceXl },
  ways: { marginTop: tokens.spaceLg, alignItems: 'flex-start' },
  small: { marginTop: tokens.spaceSm, color: tokens.colorInkSecondary },
});
