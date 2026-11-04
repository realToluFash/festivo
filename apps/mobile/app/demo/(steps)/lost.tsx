import { router, useLocalSearchParams } from 'expo-router';

import { PrimaryButton } from '../../../src/components/Buttons.tsx';
import { DemoScreen, NavBar } from '../../../src/demo/DemoScreen.tsx';
import { Heading, Plain, Steps } from '../../../src/steps/Lines.tsx';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** Three steps, said before they start, because an admin is involved; with no verified mobile, the email's alone. */
export default function LostAuthenticator() {
  const params = useLocalSearchParams<{ email?: string; emailOnly?: string }>();
  const email = params.email ?? SAMPLE.email;
  const emailOnly = params.emailOnly != null;

  return (
    <DemoScreen
      nav={<NavBar step={[1, 3]} />}
      foot={
        <PrimaryButton
          label={emailOnly ? 'Send the code' : 'Send the codes'}
          onPress={() =>
            router.push({
              pathname: '/demo/lost-codes',
              params: { email, ...(emailOnly && { emailOnly: '1' }) },
            })
          }
          testID="demo.send"
        />
      }
    >
      <Heading
        title="Get back in without your authenticator"
        intro="For when you have lost your authenticator app and your recovery codes."
      />
      <Steps
        items={[
          emailOnly
            ? `We send a code to ${email}.`
            : `We send a code to ${email}, and one to ${SAMPLE.phoneShown}.`,
          emailOnly ? 'You enter the code here.' : 'You enter the codes here.',
          `An owner or admin of ${SAMPLE.organisation} confirms it’s you. You stay signed out until they do.`,
        ]}
      />
      <Plain top={tokens.space3xl}>
        When they confirm, two-factor is turned off, every session ends, and you sign in again.
        Every step is emailed to you.
      </Plain>
    </DemoScreen>
  );
}
