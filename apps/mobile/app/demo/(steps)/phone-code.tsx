import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { QuietButton } from '../../../src/components/Buttons.tsx';
import { CodeBoxes, type CodeBoxesHandle } from '../../../src/steps/CodeBoxes.tsx';
import { DemoScreen, NavBar, finish } from '../../../src/demo/DemoScreen.tsx';
import { Confirmed, Heading, Says } from '../../../src/steps/Lines.tsx';
import { minutesSeconds, RESEND_SECONDS } from '../../../src/steps/rules.ts';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { useCountdown } from '../../../src/steps/useCountdown.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** WhatsApp first, and by text on asking; the right code ends the flow on Home. */
export default function PhoneCode() {
  const params = useLocalSearchParams<{ via?: string; phone?: string }>();
  const short = params.via === 'google' || params.via === 'apple';
  const phone = params.phone ?? SAMPLE.phoneShown;
  const [texted, setTexted] = useState(false);
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const [done, setDone] = useState(false);
  const boxes = useRef<CodeBoxesHandle>(null);
  const { left, restart } = useCountdown(RESEND_SECONDS);

  function check(full: string): void {
    if (full !== SAMPLE.code) {
      setWrong(true);
      boxes.current?.refuse();
      return;
    }
    setDone(true);
    setTimeout(() => finish(), 500);
  }

  return (
    <DemoScreen
      nav={
        <NavBar
          step={short ? [done ? 2.4 : 2, 2] : [done ? 4.4 : 4, 4]}
          right={{ label: 'Skip', onPress: () => finish() }}
        />
      }
    >
      <Heading
        title={texted ? 'Check your messages' : 'Check WhatsApp'}
        intro={
          texted ? `We texted a code to ${phone}.` : `We sent a code to your WhatsApp on ${phone}.`
        }
      />
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
          <Says
            words={`That code does not match. Check the newest ${texted ? 'text' : 'WhatsApp message'} from Soirely and try again.`}
          />
        )}
        {done && <Confirmed words="Number confirmed" />}
      </View>
      {!done && (
        <View style={styles.ways}>
          {!texted && (
            <QuietButton
              label="Text it to me instead"
              onPress={() => {
                setTexted(true);
                restart();
                boxes.current?.focus();
              }}
              testID="demo.text"
            />
          )}
          <QuietButton
            label={left > 0 ? `Send a new code in ${minutesSeconds(left)}` : 'Send a new code'}
            off={left > 0}
            onPress={() => restart()}
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
