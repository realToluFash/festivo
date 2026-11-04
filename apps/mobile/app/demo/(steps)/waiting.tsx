import { router, useLocalSearchParams } from 'expo-router';

import { QuietButton, SecondaryButton } from '../../../src/components/Buttons.tsx';
import { DemoScreen, NavBar } from '../../../src/demo/DemoScreen.tsx';
import { DemoOnly, Heading, Plain } from '../../../src/steps/Lines.tsx';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { tokens } from '../../../src/theme/tokens.ts';

const ANSWERS = [
  ['Confirm', 'approved'],
  ['Turn it down', 'turnedDown'],
  ['Let it end', 'ended'],
  ['Ask from another device', 'replaced'],
  ['Nobody can confirm', 'nobody'],
] as const;

/** Waiting in plain lines; the screen changes by itself, which the demo's buttons stand in for. */
export default function Waiting() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? SAMPLE.email;
  const end = (kind: string) =>
    router.replace({ pathname: '/demo/ending', params: { kind, email } });

  return (
    <DemoScreen
      nav={<NavBar left="close" step={[3, 3]} />}
      foot={
        <QuietButton
          label="Cancel the request"
          onPress={() => end('cancelled')}
          testID="demo.cancel"
        />
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
    </DemoScreen>
  );
}
