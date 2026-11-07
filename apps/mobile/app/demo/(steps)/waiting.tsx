import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { QuietButton, SecondaryButton } from '../../../src/components/Buttons.tsx';
import { LifecycleSheet } from '../../../src/components/LifecycleSheet.tsx';
import { Text } from '../../../src/components/Text.tsx';
import { DemoScreen, NavBar } from '../../../src/demo/DemoScreen.tsx';
import { DemoOnly, Heading, Plain } from '../../../src/steps/Lines.tsx';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { useLayout } from '../../../src/layout/useLayout.ts';
import { tokens } from '../../../src/theme/tokens.ts';

const ANSWERS = [
  ['Confirm', 'approved'],
  ['Turn it down', 'turnedDown'],
  ['Let it end', 'ended'],
  ['Ask from another device', 'replaced'],
  ['Nobody can confirm', 'nobody'],
] as const;

/** The answers sc-29961 says close the sheet: approved, turned down, replaced from another device. */
const WHILE_ASKED: readonly string[] = ['approved', 'turnedDown', 'replaced'];

/** Waiting in plain lines; the screen changes by itself, which the demo's buttons stand in for. Cancel the request asks first (sc-29961). */
export default function Waiting() {
  const params = useLocalSearchParams<{ email?: string; state?: string }>();
  const email = params.email ?? SAMPLE.email;
  const phone = useLayout().kind === 'phone';
  const opener = useRef<ViewInstance>(null);
  const [asked, setAsked] = useState<object | null>(params.state === 'cancel' ? {} : null);
  const end = (kind: string) => {
    setAsked(null);
    router.replace({ pathname: '/demo/ending', params: { kind, email } });
  };

  return (
    <DemoScreen
      nav={<NavBar left="close" step={[3, 3]} />}
      foot={
        <View style={styles.foot}>
          <Text size={tokens.typeBodyPhone.size} weight="semibold">
            This wasn’t you?
          </Text>
          <QuietButton
            ref={opener}
            label="Cancel the request"
            onPress={() => setAsked({})}
            testID="demo.cancel"
          />
        </View>
      }
    >
      <Heading
        mark={['progress', 'Waiting for an answer']}
        title={`Waiting for ${SAMPLE.organisation}`}
        intro={`We’ve asked the owners and admins of ${SAMPLE.organisation} to confirm it’s you. One answer is enough.`}
      />
      <Plain top={tokens.spaceXxl} ink>
        {`Asked ${SAMPLE.askedAt}. If nobody answers by ${SAMPLE.endsAt}, the request ends.`}
      </Plain>
      <Plain top={tokens.spaceLg}>
        {`You stay signed out until somebody answers. We’ll email ${email} either way, and this screen changes by itself.`}
      </Plain>
      <DemoOnly title={`Demo: answer as ${SAMPLE.organisation}`}>
        {ANSWERS.map(([label, kind]) => (
          <SecondaryButton
            key={kind}
            label={label}
            onPress={() => end(kind)}
            testID={`demo.answer.${kind}`}
          />
        ))}
      </DemoOnly>
      <LifecycleSheet
        phone={phone}
        open={asked != null}
        opener={opener}
        testID="demo.cancelSheet"
        title="Cancel your request?"
        lines={['You’ll need to start again to get back in.']}
        confirm={{
          label: 'Cancel the request',
          keep: 'Keep waiting',
          pending: false,
          ends: true,
          onGo: () => end('cancelled'),
        }}
        retold={asked ?? undefined}
        scrimLabel="Keep waiting"
        onClose={() => setAsked(null)}
      >
        <DemoOnly title={`Demo: answer as ${SAMPLE.organisation} while this is open`}>
          {ANSWERS.filter(([, kind]) => WHILE_ASKED.includes(kind)).map(([label, kind]) => (
            <SecondaryButton
              key={kind}
              label={label}
              onPress={() => end(kind)}
              testID={`demo.cancelSheet.answer.${kind}`}
            />
          ))}
        </DemoOnly>
      </LifecycleSheet>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  foot: { alignItems: 'center', gap: tokens.spaceXs },
});
