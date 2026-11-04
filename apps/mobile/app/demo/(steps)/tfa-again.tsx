import { PrimaryButton, QuietButton } from '../../../src/components/Buttons.tsx';
import { DemoScreen } from '../../../src/components/DemoScreen.tsx';
import { finish } from '../../../src/demo/flow.tsx';
import { Heading, Plain } from '../../../src/components/Lines.tsx';
import { tokens } from '../../../src/theme/tokens.ts';

/** Signed in after a confirmed request: set it up again, or not now. */
export default function TwoFactorAgain() {
  return (
    <DemoScreen
      foot={
        <>
          <PrimaryButton
            label="Set up two-factor"
            onPress={() => finish('In the build, this opens Set up two-factor.')}
            testID="demo.setUp"
          />
          <QuietButton label="Not now" onPress={() => finish()} testID="demo.notNow" />
        </>
      }
    >
      <Heading
        title="Set up two-factor again"
        intro="Two-factor was turned off to let you back in. Set it up again so a password alone can’t open your account."
      />
      <Plain top={tokens.spaceXl}>You can set it up any time in Settings › Security.</Plain>
    </DemoScreen>
  );
}
