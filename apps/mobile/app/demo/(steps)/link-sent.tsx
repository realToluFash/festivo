import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { PrimaryButton, QuietButton } from '../../../src/components/Buttons.tsx';
import { DemoScreen, NavBar } from '../../../src/demo/DemoScreen.tsx';
import { DemoOnly, Heading, Plain } from '../../../src/steps/Lines.tsx';
import { minutesSeconds, RESEND_SECONDS } from '../../../src/steps/rules.ts';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { useCountdown } from '../../../src/steps/useCountdown.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** The mail app is where the person goes next, so Open Mail leads. */
export default function LinkSent() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? SAMPLE.email;
  const [again, setAgain] = useState(false);
  const { left, restart } = useCountdown(again ? RESEND_SECONDS : 0);

  return (
    <DemoScreen
      nav={<NavBar left="close" />}
      foot={
        <>
          <PrimaryButton
            label="Open Mail"
            onPress={() => router.push({ pathname: '/demo/new-password', params: { email } })}
            testID="demo.openMail"
          />
          <QuietButton
            label={again && left > 0 ? `Send it again in ${minutesSeconds(left)}` : 'Send it again'}
            off={again && left > 0}
            onPress={() => {
              setAgain(true);
              restart();
            }}
            testID="demo.again"
          />
        </>
      }
    >
      <Heading
        title="Check your email"
        intro={`If ${email} has an account, we’ve sent it a link to set a new password. The link works once.`}
      />
      <Plain top={tokens.spaceXl}>
        {again
          ? 'We sent it again. Use the newest email.'
          : 'Nothing there? Check your spam folder, then send it again.'}
      </Plain>
      <DemoOnly title="Demo: Open Mail opens the link, as if it came">
        <QuietButton
          label="Open an expired link instead"
          onPress={() => router.push('/demo/link-expired')}
          testID="demo.expired"
        />
      </DemoOnly>
    </DemoScreen>
  );
}
